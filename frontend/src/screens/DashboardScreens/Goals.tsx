/*
MIT License

Copyright (c) 2022 John Damilola, Leo Hsiang, Swarangi Gaurkar, Kritika Javali, Aaron Dias Barreto

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
import { Card, Popconfirm, Button, Modal } from "antd";
import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import EmptyImg from "assets/images/empty.svg";
import { PropagateLoader } from "react-spinners";
import http from "utils/api";
import Swal from "sweetalert2";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import Navbar from "../../components/Navbar";
import activeStreakImg from "../../assets/images/streak-active.png";
import inactiveStreakImg from "../../assets/images/streak-inactive.png";

interface Deck {
  id: string;
  userId: string;
  title: string;
  description: string;
  visibility: string;
  cards_count: number;
  lastOpened?: string; // Optional for recent decks
  folderId?: string;    // Optional to track folder assignment
  streak?: number;
  goal?: string;
  goalCompleted?: boolean;
  goalProgress?: number;
  goalTarget?: number;
}

interface Folder {
  id: string;
  name: string;
  decks: Deck[];
}

const StudyHabits = () => {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [recentDecks, setRecentDecks] = useState<Deck[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [fetchingDecks, setFetchingDecks] = useState(false);
  const [isFolderPopupVisible, setIsFolderPopupVisible] = useState(false);
  const [selectedFolderDecks, setSelectedFolderDecks] = useState<Deck[]>([]);

  // for goals
  const [deckGoals, setDeckGoals] = useState<Record<string, {
    goal: string;
    completed: boolean;
    progress: number;
    target: number;
  }>>({});

  // Refs for sliders
  const sliderRefLibrary = useRef<HTMLDivElement>(null);
  const sliderRefRecent = useRef<HTMLDivElement>(null);
  const [canScrollLeftLib, setCanScrollLeftLib] = useState(false);
  const [canScrollRightLib, setCanScrollRightLib] = useState(false);
  const [canScrollLeftRec, setCanScrollLeftRec] = useState(false);
  const [canScrollRightRec, setCanScrollRightRec] = useState(false);

  const flashCardUser = window.localStorage.getItem("flashCardUser");
  const { localId } = (flashCardUser && JSON.parse(flashCardUser)) || {};

  const navigate = useNavigate();

  useEffect(() => {
    fetchDecks();
    fetchFolders();
  }, []);

  useEffect(() => {
    updateArrowsVisibilityLibrary();
    updateArrowsVisibilityRecent();
    const sliderLib = sliderRefLibrary.current;
    const sliderRec = sliderRefRecent.current;

    if (sliderLib) {
      sliderLib.addEventListener("scroll", updateArrowsVisibilityLibrary);
      return () => sliderLib.removeEventListener("scroll", updateArrowsVisibilityLibrary);
    }
    if (sliderRec) {
      sliderRec.addEventListener("scroll", updateArrowsVisibilityRecent);
      return () => sliderRec.removeEventListener("scroll", updateArrowsVisibilityRecent);
    }
  }, [decks]);

  const fetchDecks = async () => {
    setFetchingDecks(true);
    try {
      const res = await http.get("/deck/all", { params: { localId } });
      const _decks = res.data?.decks || [];
      setDecks(_decks);

      // Fetch goals for each deck
      const updatedGoals: Record<string, { goal: string; completed: boolean; progress: number; target: number; }> = {};
      await Promise.all(_decks.map(async (deck: Deck) => {
        try {
          const goalRes = await http.get(`/deck/goal/${deck.id}`);
          updatedGoals[deck.id] = {
            goal: goalRes.data.goal,
            completed: goalRes.data.goalCompleted,
            progress: goalRes.data.goalProgress,
            target: goalRes.data.goalTarget,
          };
        } catch (err) {
          console.error(`Error fetching goal for deck ${deck.id}:`, err);
        }
      }));

      setDeckGoals(updatedGoals);

      // Filter recent decks opened in the last 5 days
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      const recent = _decks
        .filter((deck: { lastOpened: string | number | Date; }) => deck.lastOpened && new Date(deck.lastOpened) >= fiveDaysAgo)
        .sort((a: { lastOpened: string | number | Date; }, b: { lastOpened: string | number | Date; }) => new Date(b.lastOpened!).getTime() - new Date(a.lastOpened!).getTime());

      setRecentDecks(recent);
    } catch (err) {
      console.error("Error fetching decks:", err);
      setDecks([]);
      setRecentDecks([]);
    } finally {
      setFetchingDecks(false);
    }
  };

  const fetchFolders = async () => {
    try {
      const res = await http.get("/folders/all", { params: { userId: localId } });
      setFolders(res.data?.folders || []);
    } catch (err) {
      console.error("Error fetching folders:", err);
    }
  };
  const updateLastOpened = async (deckId: string) => {
    const timestamp = new Date().toISOString(); // Get the current timestamp
    await http.patch(`/deck/updateLastOpened/${deckId}`, { lastOpened: timestamp });
    fetchDecks(); // Refetch the decks to update both 'decks' and 'recentDecks'
  };

  const handleFolderClick = async (folder: Folder) => {
    try {
      const res = await http.get(`/decks/${folder.id}`);
      setSelectedFolderDecks(res.data?.decks || []);
      setIsFolderPopupVisible(true);
    } catch (err) {
      console.error("Error fetching folders:", err);
    }
    setIsFolderPopupVisible(true);
  };

  const navigateToDeck = (deckId: string, deckTitle: string) => {
    navigate(`/deck/${deckId}/practice?title=${encodeURIComponent(deckTitle)}`);
  };

  const handleDeleteDeck = async (id: string) => {
    try {
      await http.delete(`/deck/delete/${id}`);
      Swal.fire("Deck Deleted Successfully!", "", "success").then(() => fetchDecks());
    } catch (err) {
      Swal.fire("Deck Deletion Failed!", "", "error");
    }
  };

  const handleAddDeckToFolder = async (deckId: string, folderId: string) => {
    try {
      await http.post("/deck/add-deck", { deckId, folderId });
      fetchDecks();
      fetchFolders();
      Swal.fire("Deck added to folder!", "", "success");
    } catch (err) {
      Swal.fire("Failed to add deck to folder!", "", "error");
    }
  };

  // Update arrows visibility based on scroll position
  const updateArrowsVisibilityLibrary = () => {
    if (sliderRefLibrary.current) {
      const { scrollLeft, scrollWidth, clientWidth } = sliderRefLibrary.current;
      setCanScrollLeftLib(scrollLeft > 0);
      setCanScrollRightLib(scrollLeft + clientWidth < scrollWidth);
    }
  };

  const updateArrowsVisibilityRecent = () => {
    if (sliderRefRecent.current) {
      const { scrollLeft, scrollWidth, clientWidth } = sliderRefRecent.current;
      setCanScrollLeftRec(scrollLeft > 0);
      setCanScrollRightRec(scrollLeft + clientWidth < scrollWidth);
    }
  };

  const scrollLibrary = (direction: "left" | "right") => {
    if (sliderRefLibrary.current) {
      const scrollAmount = direction === "left" ? -300 : 300;
      sliderRefLibrary.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const scrollRecent = (direction: "left" | "right") => {
    if (sliderRefRecent.current) {
      const scrollAmount = direction === "left" ? -300 : 300;
      sliderRefRecent.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const studyGoals = [
    "Study for 20 minutes",
    "Review 3 different decks",
    "Add 5 new flashcards to any deck",
    "Review your mistakes",
    "Take a quiz in any deck"
  ]

  const [goal, setGoal] = useState<string>("");
  const [completed, setCompleted] = useState<boolean>(false);

  useEffect(() => {
    const savedGoal = localStorage.getItem("dailyGoal");
    const savedDate = localStorage.getItem("goalDate");

    const today = new Date().toDateString();

    if (!savedGoal || savedDate !== today) {
      const newGoal = studyGoals[Math.floor(Math.random() * studyGoals.length)];
      localStorage.setItem("dailyGoal", newGoal);
      localStorage.setItem("goalDate", today);
      setGoal(newGoal);
    } else {
      setGoal(savedGoal);
    }

    const savedCompletion = localStorage.getItem("goalCompleted");
    if (savedCompletion == "true") {
      setCompleted(true);
    }
  }, []);

  const handleComplete = () => {
    setCompleted(true);
    localStorage.setItem("goalCompleted", "true");
  };

  const completeGoal = async (deckId: string) => {
    try {
      await http.patch(`/deck/goal/${deckId}`);
      setDeckGoals((prevGoals) => ({
        ...prevGoals,
        [deckId]: { ...prevGoals[deckId], completed: true },
      }));
    } catch (err) {
      console.error(`Error completing goal for deck ${deckId}:`, err);
    }
  };

  const updateGoalProgress = async (deckId: string, progress: number) => {
    try {
      await http.patch(`/deck/goal/${deckId}`, { progress });
      setDeckGoals((prevGoals) => ({
        ...prevGoals,
        [deckId]: {
          ...prevGoals[deckId],
          progress: prevGoals[deckId]?.progress + progress,
          completed: prevGoals[deckId]?.progress + progress >= prevGoals[deckId]?.target,
        },
      }));
    } catch (err) {
      console.error(`Error updating goal for deck ${deckId}:`, err);
    }
  };


  return (
    <div className="dashboard-page dashboard-commons">
      <Navbar isDashboard={true} onFolderCreated={fetchFolders} />

      <section>
        <div className="container">
          <div className="row">
            <div className="col-md-12">
              <Card className="welcome-card border-[#E7EAED]">
                <div className="welcome-container">
                  {/* Study Habit Message */}
                  <div className="welcome-text">
                    <h3><b>🎯 Today's Study Goals</b></h3>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Goals Section */}
          <div className="goal-section">
            <div className="deck-container">
              {decks.map(({ id, title, description, visibility, cards_count, streak, }) => (
                <div className="deck-goal">
                  <div className="align-items-center">
                    <Link to={`/deck/${id}/practice`} onClick={() => updateLastOpened(id)}>
                      <h5>{title}</h5>
                    </Link>
                    <p className="goal-text">{deckGoals[id]?.goal || "No goal assigned"}</p>
                    {deckGoals[id]?.completed ? "✅ Completed" : "❌ Not Completed"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Deck Goals Section */}
          <div className="deck-slider" ref={sliderRefLibrary}>

          </div>
          {/* Recent Decks Section */}
          < div className="row mt-4" >
            <div className="col-md-12">
              <p className="title">Recent Decks</p>
            </div>
            {
              recentDecks.length === 0 ? (
                <div className="row justify-content-center">
                  <p>No Recent Decks Opened</p>
                </div>
              ) : (
                <div className="slider-container">
                  {canScrollLeftRec && (
                    <button className="arrow left" onClick={() => scrollRecent("left")}>
                      <LeftOutlined />
                    </button>
                  )}
                  <div className="deck-slider" ref={sliderRefRecent}>
                    {recentDecks.map(({ id, title, description, visibility, cards_count }) => (
                      <div className="deck-card" key={id}>
                        <div className="d-flex justify-content-between align-items-center">
                          <Link to={`/deck/${id}/practice`} onClick={() => updateLastOpened(id)}>
                            <h5>{title}</h5>
                          </Link>
                          <div className="d-flex gap-2 visibility-status align-items-center">
                            {visibility === "public" ? <i className="lni lni-world"></i> : <i className="lni lni-lock-alt"></i>}
                            {visibility}
                          </div>
                        </div>
                        <p className="description">{description}</p>
                        <p className="items-count">{cards_count} item(s)</p>
                      </div>
                    ))}
                  </div>
                  {canScrollRightRec && (
                    <button className="arrow right" onClick={() => scrollRecent("right")}>
                      <RightOutlined />
                    </button>
                  )}
                </div>
              )
            }
          </div>

          {/* Folder Decks Modal */}
          {/* <Modal
            title="Folder Decks"
            open={isFolderPopupVisible}
            onCancel={() => setIsFolderPopupVisible(false)}
            footer={null}
          >
            {selectedFolderDecks.length === 0 ? (
              <p>No decks in this folder.</p>
            ) : (
              selectedFolderDecks.map(({ id, title }, index) => (
                <div key={index}>
                  <Button className="folder-deck-button" onClick={() => navigateToDeck(id, title)}>
                    {title}
                  </Button>
                </div>
              ))
            )}
          </Modal>*/}
        </div>
      </section >
    </div >
  );
};

export default StudyHabits;



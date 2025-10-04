// File: src/components/ChatBot.jsx
import React, { useState, useEffect, useRef } from "react";
import API from "../services/api";
import styles from "./ChatBot.module.css";
import {
  FiSend,
  FiMenu,
  FiX,
  FiUser,
  FiPhone,
  FiMail,
  FiGlobe,
  FiUsers,
  FiCheck,
  FiXCircle,
} from "react-icons/fi";
import { t } from "../utils/locale";
import ChatBox from "./ChatBot/ChatBox";
import MessageBubble from "./ChatBot/MessageBubble";
import QuickActions from "./ChatBot/QuickActions";
import AdminLoginForm from "./Admin/AdminLoginForm";
import AdminDashboard from "./Admin/AdminDashboard";

// Unique id generator for messages
const uid = () => Date.now() + Math.floor(Math.random() * 1000);

// Helper to detect language from user input
const detectLanguage = (text) => {
  const lowered = text.toLowerCase();
  if (lowered.includes("english")) return "english";
  if (lowered.includes("hindi") || lowered.includes("हिंदी")) return "hindi";
  return null;
};

// Emoji mapping helper — choose emoji based on context/type/text
const getEmojiFor = (typeOrText = "") => {
  const s = (typeOrText || "").toString().toLowerCase();
  if (s.includes("greet") || s.includes("hello") || s.includes("hi"))
    return "👋";
  if (s.includes("success") || s.includes("created") || s.includes("profile"))
    return "✅";
  if (s.includes("error") || s.includes("fail") || s.includes("❌"))
    return "❌";
  if (s.includes("order") || s.includes("placed") || s.includes("medicine"))
    return "📦";
  if (s.includes("appointment") || s.includes("book")) return "📅";
  if (s.includes("contact") || s.includes("phone") || s.includes("email"))
    return "📞";
  if (s.includes("choose") || s.includes("menu")) return "🔽";
  if (s.includes("register") || s.includes("profile")) return "📝";
  if (s.includes("please") || s.includes("fill") || s.includes("required"))
    return "⚠️";
  if (s.includes("thanks") || s.includes("thank")) return "🙏";
  // default small info emoji
  return "ℹ️";
};

export default function ChatBot() {
  // Language and profile
  const [language, setLanguage] = useState("english");

  // one-time guard to avoid double side-effects in React Strict Mode (dev)
  const didInitRef = useRef(false);

  // profile & auth state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [isAdmin, setIsAdmin] = useState(!!localStorage.getItem("adminToken"));

  // UI state
  const [messages, setMessages] = useState([]); // initial messages pushed in useEffect above
  const [menuOpen, setMenuOpen] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [botTyping, setBotTyping] = useState(false);

  // flows and drafts
  const [flow, setFlow] = useState(null);
  const [orderDraft, setOrderDraft] = useState({
    medicines: [{ name: "", quantity: 1 }],
    address: "",
    deliveryOption: "pickup", // 'pickup' | 'home delivery'
    paymentMethod: "COD", // 'COD' | 'UPI'
    notes: "",
  });
  const [apptDraft, setApptDraft] = useState({
    patientName: "", // new patient name field
    doctorName: "Dr. Sharma",
    date: "",
    time: "",
    age: "",
    gender: "Male", // NEW: gender field added (default Male)
    problem: "",
  });
  const [pendingFeedback, setPendingFeedback] = useState(null); // { orderId, type: 'order' | 'appointment' }
  const [feedbackText, setFeedbackText] = useState("");

  // New states for edit and cancel
  const [editModal, setEditModal] = useState(null); // { type: 'order'|'appointment', item: order/appt object }
  const [cancelConfirm, setCancelConfirm] = useState(null); // { type, id, name }
  const [editForm, setEditForm] = useState({}); // form data for editing

  // Handlers for edit and cancel
  const handleEditOrder = async () => {
    if (!editForm.medicines || !editForm.medicines.length) return;
    setLoading(true);
    try {
      const res = await API.patch(
        `/api/orders/${editModal.item._id}`,
        editForm
      );
      pushBot(res.data?.message || "✅ Order updated successfully!", {
        type: "success",
        instant: true,
      });
      setEditModal(null);
      setEditForm({});
      // Refetch orders
      fetchOrdersForUser(true);
    } catch (err) {
      console.error("Edit order error:", err);
      pushBot(`❌ ${err?.response?.data?.message || err.message}`, {
        type: "error",
        instant: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditAppointment = async () => {
    if (!editForm.date || !editForm.time) return;
    setLoading(true);
    try {
      const res = await API.patch(
        `/api/appointments/${editModal.item._id}`,
        editForm
      );
      pushBot(res.data?.message || "✅ Appointment updated successfully!", {
        type: "success",
        instant: true,
      });
      setEditModal(null);
      setEditForm({});
      // Refetch appointments
      fetchAppointmentsForUser(true);
    } catch (err) {
      console.error("Edit appointment error:", err);
      pushBot(`❌ ${err?.response?.data?.message || err.message}`, {
        type: "error",
        instant: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    setLoading(true);
    try {
      const res = await API.delete(`/orders/${cancelConfirm.id}`);
      pushBot(res.data?.message || "✅ Order cancelled successfully!", {
        type: "success",
        instant: true,
      });
      setCancelConfirm(null);
      // Refetch orders
      fetchOrdersForUser(true);
    } catch (err) {
      console.error("Cancel order error:", err);
      pushBot(`❌ ${err?.response?.data?.message || err.message}`, {
        type: "error",
        instant: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async () => {
    setLoading(true);
    try {
      const res = await API.delete(`/appointments/${cancelConfirm.id}`);
      pushBot(res.data?.message || "✅ Appointment cancelled successfully!", {
        type: "success",
        instant: true,
      });
      setCancelConfirm(null);
      // Refetch appointments
      fetchAppointmentsForUser(true);
    } catch (err) {
      console.error("Cancel appointment error:", err);
      pushBot(`❌ ${err?.response?.data?.message || err.message}`, {
        type: "error",
        instant: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // login modal state
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginPhone, setLoginPhone] = useState("");

  const bottomRef = useRef(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // On mount: restore localStorage state + token header
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    const token = localStorage.getItem("rm_token");
    if (token) {
      API.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }

    const saved = localStorage.getItem("rm_user");
    if (saved) {
      try {
        const obj = JSON.parse(saved);
        if (obj?.name) setName(obj.name);
        if (obj?.phone) setPhone(obj.phone);
        if (obj?.email) setEmail(obj.email);
        if (obj?.language) setLanguage(obj.language);
        if (obj?.isRegistered) setIsRegistered(true);
      } catch (e) {
        /* ignore parse error */
      }
    }

    // Friendly 25-word greeting shown once on mount
    pushBot(
      "👋 Welcome to Ranjan Medicine! We're here to help with medicine orders, appointments, and quick health advice. Type 'Hi' to start — I'll assist you today.",
      { type: "greet", instant: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // message helpers - improved: adds emoji and a timestamp automatically
  const pushBot = (text, meta = {}) => {
    // meta: { type, instant, showQuickAfter }
    const emoji = meta.emoji === false ? "" : getEmojiFor(meta.type || text);
    // If text already starts with a hand or error emoji we keep it as is
    const final =
      text.startsWith("👋") || text.startsWith("❌") || text.startsWith("📦")
        ? text
        : `${emoji} ${text}`;

    const msg = {
      id: uid(),
      from: "bot",
      text: final,
      type: meta.type,
      time: new Date().toISOString(),
    };

    // optionally show a very small typing animation for realism
    if (meta.instant) {
      setMessages((m) => [...m, msg]);
      if (meta.showQuickAfter) setTimeout(() => showQuickActionsInChat(), 300);
      return;
    }

    // show a short typed effect (non-blocking) — push message immediately & flash typing for micro-UX
    setMessages((m) => [...m, msg]);
    setBotTyping(true);
    setTimeout(() => setBotTyping(false), 650);

    if (meta.showQuickAfter) setTimeout(() => showQuickActionsInChat(), 350);
  };

  const pushUser = (text) =>
    setMessages((m) => [
      ...m,
      { id: uid(), from: "user", text, time: new Date().toISOString() },
    ]);

  // quick actions: push a message of type 'quick' so we render buttons dynamically
  const showQuickActions = () => {
    pushBot(t(language, "chooseOption"), { type: "choose", instant: true });
    // immediate quick actions so user can tap
    setMessages((m) => [
      ...m,
      {
        id: uid(),
        from: "bot",
        text: t(language, "chooseOption"),
        type: "quick",
        time: new Date().toISOString(),
      },
    ]);
  };

  const showQuickActionsInChat = () => showQuickActions();

  // render-time helpers: these components are rendered using current state so inputs stay live
  const renderMessageContent = (m) => {
    if (m.type === "quick") {
      return <QuickActions language={language} onAction={handleChoice} />;
    }

    if (m.type === "authRequired") {
      const title =
        m.authType === "orders"
          ? t(language, "myOrders")
          : t(language, "myAppointments");
      return (
        <ChatBox title={title}>
          <div style={{ textAlign: "center", padding: "20px" }}>
            <p>
              {language === "english"
                ? "You need to register or login to view this."
                : "यह देखने के लिए आपको रजिस्टर या लॉगिन करना होगा।"}
            </p>
            <div className={styles.confirmRow}>
              <button
                className={styles.confirmBtn}
                onClick={() =>
                  openRegisterFlow(
                    m.authType === "orders" ? "ordering" : "appointment"
                  )
                }
              >
                {t(language, "registerLabel")}
              </button>
              <button
                className={styles.actionBtn}
                onClick={() => openLoginModal()}
              >
                {language === "english" ? "Login" : "लॉगिन"}
              </button>
            </div>
          </div>
        </ChatBox>
      );
    }

    if (m.type === "orderCard") {
      const o = m.order;
      const meds = (o.medicines || [])
        .map((med) => `${med.name} x ${med.quantity}`)
        .join(", ");
      return (
        <ChatBox title={`📦 Order ${o.orderId || o._id}`}>
          <div style={{ padding: "10px" }}>
            <p>
              <strong>Medicines:</strong> {meds}
            </p>
            <p>
              <strong>Status:</strong> {o.status || "pending"}
            </p>
            <p>
              <strong>Delivery:</strong> {o.deliveryOption || "pickup"}
            </p>
            {o.address && (
              <p>
                <strong>Address:</strong> {o.address}
              </p>
            )}
            <p>
              <strong>Payment:</strong> {o.paymentMethod || "COD"}
            </p>
            {o.notes && (
              <p>
                <strong>Notes:</strong> {o.notes}
              </p>
            )}
            <div className={styles.confirmRow} style={{ marginTop: 10 }}>
              {o.status === "pending" && (
                <>
                  <button
                    className={styles.actionBtn}
                    onClick={() => {
                      setEditModal({ type: "order", item: o });
                      setEditForm({
                        medicines: o.medicines || [{ name: "", quantity: 1 }],
                        address: o.address || "",
                        deliveryOption: o.deliveryOption || "pickup",
                        paymentMethod: o.paymentMethod || "COD",
                        notes: o.notes || "",
                      });
                    }}
                  >
                    {language === "english" ? "Edit" : "संपादित करें"}
                  </button>
                  <button
                    className={styles.cancelBtn}
                    onClick={() =>
                      setCancelConfirm({ type: "order", id: o._id, name: meds })
                    }
                  >
                    {language === "english" ? "Cancel" : "रद्द करें"}
                  </button>
                </>
              )}
              <button
                className={styles.actionBtn}
                onClick={() => {
                  setPendingFeedback({ orderId: o._id, type: "order" });
                  setMessages((msgs) => [
                    ...msgs,
                    {
                      id: uid(),
                      from: "bot",
                      text: "",
                      type: "feedbackForm",
                      time: new Date().toISOString(),
                    },
                  ]);
                }}
                disabled={o.feedback !== undefined && o.feedback !== ""}
              >
                {o.feedback !== undefined && o.feedback !== ""
                  ? language === "english"
                    ? "Feedback Submitted"
                    : "प्रतिक्रिया दी गई"
                  : language === "english"
                  ? "Submit Feedback"
                  : "प्रतिक्रिया दें"}
              </button>
            </div>
          </div>
        </ChatBox>
      );
    }

    if (m.type === "apptCard") {
      const a = m.appointment;
      return (
        <ChatBox title={`📅 Appointment ${a.orderId || a._id}`}>
          <div style={{ padding: "10px" }}>
            <p>
              <strong>Doctor:</strong> {a.doctorName || "-"}
            </p>
            <p>
              <strong>Date:</strong> {a.date || "-"}
            </p>
            <p>
              <strong>Time:</strong> {a.time || "-"}
            </p>
            <p>
              <strong>Age:</strong> {a.age || "-"}
            </p>
            <p>
              <strong>Gender:</strong> {a.gender || "-"}
            </p>
            <p>
              <strong>Problem:</strong> {a.problem || "-"}
            </p>
            <p>
              <strong>Status:</strong> {a.status || "pending"}
            </p>
            <div className={styles.confirmRow} style={{ marginTop: 10 }}>
              {a.status === "pending" && (
                <>
                  <button
                    className={styles.actionBtn}
                    onClick={() => {
                      setEditModal({ type: "appointment", item: a });
                      setEditForm({
                        patientName: a.patientName || "",
                        doctorName: a.doctorName || "Dr. Sharma",
                        date: a.date || "",
                        time: a.time || "",
                        age: a.age || "",
                        gender: a.gender || "Male",
                        problem: a.problem || "",
                      });
                    }}
                  >
                    {language === "english" ? "Edit" : "संपादित करें"}
                  </button>
                  <button
                    className={styles.cancelBtn}
                    onClick={() =>
                      setCancelConfirm({
                        type: "appointment",
                        id: a._id,
                        name: `${a.doctorName} on ${a.date}`,
                      })
                    }
                  >
                    {language === "english" ? "Cancel" : "रद्द करें"}
                  </button>
                </>
              )}
              <button
                className={styles.actionBtn}
                onClick={() => {
                  setPendingFeedback({ orderId: a._id, type: "appointment" });
                  setMessages((msgs) => [
                    ...msgs,
                    {
                      id: uid(),
                      from: "bot",
                      text: "",
                      type: "feedbackForm",
                      time: new Date().toISOString(),
                    },
                  ]);
                }}
                disabled={a.feedback !== undefined && a.feedback !== ""}
              >
                {a.feedback !== undefined && a.feedback !== ""
                  ? language === "english"
                    ? "Feedback Submitted"
                    : "प्रतिक्रिया दी गई"
                  : language === "english"
                  ? "Submit Feedback"
                  : "प्रतिक्रिया दें"}
              </button>
            </div>
          </div>
        </ChatBox>
      );
    }

    if (m.type === "orderForm") {
      return (
        <ChatBox title={t(language, "orderMedicine")}>
          {/* Dynamic medicines list */}
          {orderDraft.medicines.map((it, idx) => (
            <div className={styles.chatFormRow} key={idx}>
              <label>Medicine #{idx + 1}</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  className={styles.chatInput}
                  value={it.name}
                  onChange={(e) =>
                    setOrderDraft((d) => {
                      const copy = { ...d, medicines: [...d.medicines] };
                      copy.medicines[idx] = {
                        ...copy.medicines[idx],
                        name: e.target.value,
                      };
                      return copy;
                    })
                  }
                  placeholder={t(language, "medicinePlaceholder")}
                />
                <input
                  className={styles.chatInput}
                  style={{ width: 90 }}
                  type="number"
                  min={1}
                  value={it.quantity}
                  onChange={(e) =>
                    setOrderDraft((d) => {
                      const copy = { ...d, medicines: [...d.medicines] };
                      copy.medicines[idx] = {
                        ...copy.medicines[idx],
                        quantity: Number(e.target.value),
                      };
                      return copy;
                    })
                  }
                />
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() =>
                    setOrderDraft((d) => {
                      const copy = {
                        ...d,
                        medicines: d.medicines.filter((_, i) => i !== idx),
                      };
                      if (!copy.medicines.length)
                        copy.medicines = [{ name: "", quantity: 1 }];
                      return copy;
                    })
                  }
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <div className={styles.chatFormRow}>
            <button
              type="button"
              className={styles.confirmBtn}
              onClick={() =>
                setOrderDraft((d) => ({
                  ...d,
                  medicines: [...d.medicines, { name: "", quantity: 1 }],
                }))
              }
            >
              + Add another medicine
            </button>
          </div>

          <div className={styles.chatFormRow}>
            <label>Delivery Option</label>
            <select
              className={styles.chatInput}
              value={orderDraft.deliveryOption}
              onChange={(e) =>
                setOrderDraft((d) => ({ ...d, deliveryOption: e.target.value }))
              }
            >
              <option value="pickup">Pickup from Shop</option>
              <option value="home delivery">Home Delivery</option>
            </select>
          </div>

          {orderDraft.deliveryOption === "home delivery" && (
            <div className={styles.chatFormRow}>
              <label>Address</label>
              <input
                className={styles.chatInput}
                value={orderDraft.address}
                onChange={(e) =>
                  setOrderDraft((d) => ({ ...d, address: e.target.value }))
                }
                placeholder={t(language, "addressPlaceholder")}
              />
            </div>
          )}

          <div className={styles.chatFormRow}>
            <label>Payment Method</label>
            <select
              className={styles.chatInput}
              value={orderDraft.paymentMethod}
              onChange={(e) =>
                setOrderDraft((d) => ({ ...d, paymentMethod: e.target.value }))
              }
            >
              <option value="COD">Cash on Delivery (COD)</option>
              <option value="UPI">UPI</option>
            </select>
          </div>

          <div className={styles.chatFormRow}>
            <label>Notes (optional)</label>
            <textarea
              className={styles.chatInput}
              rows={2}
              value={orderDraft.notes}
              onChange={(e) =>
                setOrderDraft((d) => ({ ...d, notes: e.target.value }))
              }
              placeholder={
                language === "english"
                  ? "Any delivery instructions..."
                  : "कोई निर्देश..."
              }
            />
          </div>

          <div className={styles.confirmRow}>
            <button
              type="button"
              className={styles.confirmBtn}
              onClick={() => confirmPlaceOrder()}
            >
              {t(language, "confirm")} <FiCheck />
            </button>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => goToMenuFromChat()}
            >
              {t(language, "goBack")} <FiXCircle />
            </button>
          </div>
        </ChatBox>
      );
    }

    if (m.type === "apptForm") {
      return (
        <ChatBox title={t(language, "bookAppointment")}>
          <div className={styles.chatFormRow}>
            <label>Patient Name (if different from account holder)</label>
            <input
              className={styles.chatInput}
              value={apptDraft.patientName}
              onChange={(e) =>
                setApptDraft((s) => ({ ...s, patientName: e.target.value }))
              }
              placeholder={
                language === "english" ? "Patient Name" : "रोगी का नाम"
              }
            />
          </div>
          <div className={styles.chatFormRow}>
            <label>Doctor</label>
            <select
              className={styles.chatInput}
              value={apptDraft.doctorName}
              onChange={(e) =>
                setApptDraft((s) => ({ ...s, doctorName: e.target.value }))
              }
            >
              <option>Dr. Sharma</option>
              <option>Dr. Verma</option>
              <option>Dr. Gupta</option>
            </select>
          </div>
          <div className={styles.chatFormRow}>
            <label>Date</label>
            <input
              className={styles.chatInput}
              type="date"
              value={apptDraft.date}
              onChange={(e) =>
                setApptDraft((s) => ({ ...s, date: e.target.value }))
              }
            />
          </div>
          <div className={styles.chatFormRow}>
            <label>Time</label>
            <input
              className={styles.chatInput}
              type="time"
              value={apptDraft.time}
              onChange={(e) =>
                setApptDraft((s) => ({ ...s, time: e.target.value }))
              }
            />
          </div>
          <div className={styles.chatFormRow}>
            <label>Age</label>
            <input
              className={styles.chatInput}
              value={apptDraft.age}
              onChange={(e) =>
                setApptDraft((s) => ({ ...s, age: e.target.value }))
              }
            />
          </div>
          <div className={styles.chatFormRow}>
            <label>Gender</label>
            <select
              className={styles.chatInput}
              value={apptDraft.gender}
              onChange={(e) =>
                setApptDraft((s) => ({ ...s, gender: e.target.value }))
              }
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className={styles.chatFormRow}>
            <label>Problem</label>
            <input
              className={styles.chatInput}
              value={apptDraft.problem}
              onChange={(e) =>
                setApptDraft((s) => ({ ...s, problem: e.target.value }))
              }
              placeholder={
                language === "english"
                  ? "Brief description"
                  : "संक्षेप में बताएं"
              }
            />
          </div>
          <div className={styles.confirmRow}>
            <button
              className={styles.confirmBtn}
              onClick={() => confirmPlaceAppointment()}
            >
              {t(language, "confirm")} <FiCheck />
            </button>
            <button
              className={styles.cancelBtn}
              onClick={() => goToMenuFromChat()}
            >
              {t(language, "goBack")} <FiXCircle />
            </button>
          </div>
        </ChatBox>
      );
    }

    if (m.type === "feedbackForm") {
      return (
        <ChatBox title={language === "english" ? "Feedback" : "प्रतिक्रिया"}>
          <div className={styles.chatFormRow}>
            <label>
              {language === "english"
                ? "Please share your feedback:"
                : "कृपया अपनी प्रतिक्रिया साझा करें:"}
            </label>
            <textarea
              className={styles.chatInput}
              rows={4}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder={
                language === "english"
                  ? "Your feedback here..."
                  : "आपकी प्रतिक्रिया यहाँ..."
              }
            />
          </div>
          <div className={styles.confirmRow}>
            <button
              className={styles.confirmBtn}
              onClick={() => submitFeedback()}
            >
              {language === "english" ? "Submit" : "सबमिट"} <FiCheck />
            </button>
            <button
              className={styles.cancelBtn}
              onClick={() => {
                setPendingFeedback(null);
                setFeedbackText("");
                goToMenuFromChat();
              }}
            >
              {language === "english" ? "Skip" : "छोड़ें"} <FiXCircle />
            </button>
          </div>
        </ChatBox>
      );
    }

    // default: no extra content
    return null;
  };

  // go back to menu
  const goToMenuFromChat = () => {
    setFlow(null);
    setOrderDraft({
      medicines: [{ name: "", quantity: 1 }],
      address: "",
      deliveryOption: "pickup",
      paymentMethod: "COD",
      notes: "",
    });
    setApptDraft({
      patientName: "",
      doctorName: "Dr. Sharma",
      date: "",
      time: "",
      age: "",
      gender: "Male",
      problem: "",
    });
    setTimeout(() => {
      pushBot(t(language, "backToMenu"), {
        type: "choose",
        instant: true,
        showQuickAfter: true,
      });
    }, 300);
  };

  // handle choices
  const handleChoice = (choice) => {
    // prevent duplicate register prompts
    if (choice === "1") {
      if (!isRegistered) {
        if (flow?.type === "register") return;
        pushBot(t(language, "registerFirst"), {
          type: "register",
          instant: true,
        });
        openRegisterFlow("ordering");
      } else {
        // push an order form message (type based)
        setMessages((m) => [
          ...m,
          {
            id: uid(),
            from: "bot",
            text: t(language, "fillOrderDetails"),
            type: "orderForm",
            time: new Date().toISOString(),
          },
        ]);
        setFlow({ type: "ordering", step: "form" });
      }
      setMenuOpen(false);
    } else if (choice === "2") {
      if (!isRegistered) {
        if (flow?.type === "register") return;
        pushBot(t(language, "registerFirst"), {
          type: "register",
          instant: true,
        });
        openRegisterFlow("appointment");
      } else {
        setMessages((m) => [
          ...m,
          {
            id: uid(),
            from: "bot",
            text: t(language, "fillAppointmentDetails"),
            type: "apptForm",
            time: new Date().toISOString(),
          },
        ]);
        setFlow({ type: "appointment", step: "form" });
      }
      setMenuOpen(false);
    } else if (choice === "3") {
      if (!isRegistered) {
        showAuthRequiredCard("orders");
        return;
      }
      fetchOrdersForUser(true);
      setMenuOpen(false);
    } else if (choice === "4") {
      if (!isRegistered) {
        showAuthRequiredCard("appointments");
        return;
      }
      fetchAppointmentsForUser(true);
      setMenuOpen(false);
    } else if (choice === "contact") {
      pushBot(t(language, "contactUs"), { type: "contact", instant: true });
      pushBot("📧 ranjanmedicine5@gmail.com", {
        type: "contact",
        instant: true,
      });
      pushBot("📞 +91 83692 42977", { type: "contact", instant: true });
      setMenuOpen(false);
    } else if (choice === "exit") {
      handleLogout(); // ensure a full logout if they choose exit
    }
  };

  // register flow: language -> name -> phone -> email
  const openRegisterFlow = (nextAfter) => {
    // prevent showing if already in register
    if (flow?.type === "register") return;
    setFlow({ type: "register", step: "language", nextAfter });
    // ask language only if not chosen, but we will ask in user's current language
    pushBot(t(language, "whichLanguage"), { type: "register", instant: true });
  };

  const handleRegisterStep = async (text) => {
    if (!flow) return;
    const step = flow.step;
    if (step === "language") {
      const pref = text.toLowerCase().includes("hindi") ? "hindi" : "english";
      setLanguage(pref);
      setFlow((f) => ({ ...f, step: "name" }));
      pushBot(t(pref, "enterName"), { type: "register", instant: true });
      return;
    }
    if (step === "name") {
      setName(text);
      setFlow((f) => ({ ...f, step: "phone" }));
      pushBot(t(language, "enterPhone"), { type: "register", instant: true });
      return;
    }
    if (step === "phone") {
      setPhone(text);
      setFlow((f) => ({ ...f, step: "email" }));
      pushBot(t(language, "enterEmail"), { type: "register", instant: true });
      return;
    }
    if (step === "email") {
      if (!text || !text.includes("@")) {
        pushBot(t(language, "enterEmail"), { type: "error", instant: true });
        return;
      }
      setEmail(text);
      setLoading(true);
      pushBot(t(language, "creatingProfile"), { type: "info", instant: true });
      try {
        // NOTE: your backend supports returning a token on register (userController.registerUser)
        const res = await API.post("/users/register", {
          name,
          phone,
          email: text,
          language,
        });

        // If backend returned token, save it and set header
        if (res.data?.token) {
          const token = res.data.token;
          localStorage.setItem("rm_token", token);
          API.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        }

        setIsRegistered(true);
        setFlow(null);
        pushBot(res.data?.reply || t(language, "profileCreated"), {
          type: "success",
          instant: true,
        });
        // persist profile locally so we don't ask again
        localStorage.setItem(
          "rm_user",
          JSON.stringify({
            name,
            phone,
            email: text,
            language,
            isRegistered: true,
          })
        );
        // continue
        if (flow.nextAfter === "ordering") {
          setMessages((m) => [
            ...m,
            {
              id: uid(),
              from: "bot",
              text: t(language, "fillOrderDetails"),
              type: "orderForm",
              time: new Date().toISOString(),
            },
          ]);
          setFlow({ type: "ordering", step: "form" });
        } else if (flow.nextAfter === "appointment") {
          setMessages((m) => [
            ...m,
            {
              id: uid(),
              from: "bot",
              text: t(language, "fillAppointmentDetails"),
              type: "apptForm",
              time: new Date().toISOString(),
            },
          ]);
          setFlow({ type: "appointment", step: "form" });
        } else {
          showQuickActionsInChat();
        }
      } catch (err) {
        console.error("Register error:", err);
        pushBot(
          `❌ ${
            err?.response?.data?.reply ||
            err?.response?.data?.message ||
            err.message
          }`,
          {
            type: "error",
            instant: true,
          }
        );
      } finally {
        setLoading(false);
      }
      return;
    }
  };

  // ===== Login / Logout handling =====
  const openLoginModal = () => {
    setLoginPhone("");
    setLoginOpen(true);
  };

  const closeLoginModal = () => {
    setLoginOpen(false);
    setLoginPhone("");
  };

  const loginWithPhone = async () => {
    if (!loginPhone || !String(loginPhone).trim())
      return pushBot(t(language, "pleaseFill"), {
        type: "warning",
        instant: true,
      });
    setLoading(true);
    try {
      // call auth login - backend route: POST /api/users/login
      const res = await API.post("/users/login", {
        phone: loginPhone.trim(),
      });

      const token = res.data?.token;
      const user = res.data?.user || res.data?.user; // sometimes reply has user
      // store token and user
      if (token) {
        localStorage.setItem("rm_token", token);
        API.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      }
      if (user) {
        setName(user.name || "");
        setPhone(user.phone || loginPhone.trim());
        setEmail(user.email || "");
        localStorage.setItem(
          "rm_user",
          JSON.stringify({ ...user, isRegistered: true })
        );
      } else {
        // fallback: if server didn't return user, store phone
        setPhone(loginPhone.trim());
        localStorage.setItem(
          "rm_user",
          JSON.stringify({
            name: name || "",
            phone: loginPhone.trim(),
            email: email || "",
            language,
            isRegistered: true,
          })
        );
      }

      setIsRegistered(true);
      pushBot(
        res.data?.reply ||
          (language === "english"
            ? "✅ Logged in successfully"
            : "✅ आप सफलतापूर्वक लॉग इन हो गए"),
        { type: "success", instant: true }
      );
      closeLoginModal();
      setFlow(null);
      setTimeout(() => showQuickActionsInChat(), 300);
    } catch (err) {
      console.error("Login error:", err);
      pushBot(
        `❌ ${
          err?.response?.data?.reply ||
          err?.response?.data?.message ||
          err?.message
        }`,
        { type: "error", instant: true }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsRegistered(false);
    setName("");
    setPhone("");
    setEmail("");
    setLanguage("english");
    localStorage.removeItem("rm_user");
    localStorage.removeItem("rm_token");
    delete API.defaults.headers.common["Authorization"];
    setMessages([
      {
        id: uid(),
        from: "bot",
        text: `${t(language, "greeting")} — ${t(language, "exit")}`,
        time: new Date().toISOString(),
      },
    ]);
    setFlow(null);
  };

  // confirm Place Order
  const confirmPlaceOrder = async () => {
    if (!isRegistered)
      return pushBot(t(language, "registerFirst"), {
        type: "register",
        instant: true,
      });

    const { medicines, address, deliveryOption, paymentMethod, notes } =
      orderDraft;

    // basic validation
    const validMedicines =
      Array.isArray(medicines) &&
      medicines.length &&
      medicines.every(
        (m) =>
          m.name &&
          String(m.name).trim() &&
          m.quantity &&
          Number(m.quantity) > 0
      );
    if (!validMedicines)
      return pushBot(t(language, "pleaseFill"), {
        type: "warning",
        instant: true,
      });
    if (deliveryOption === "home delivery" && (!address || !address.trim()))
      return pushBot(t(language, "pleaseFill"), {
        type: "warning",
        instant: true,
      });

    setLoading(true);
    try {
      const payload = {
        medicines,
        address: deliveryOption === "home delivery" ? address : "",
        deliveryOption,
        paymentMethod,
        notes,
      };

      const res = await API.post("/orders", payload);
      pushBot(res.data?.reply || t(language, "placeOrderSuccess"), {
        type: "order",
        instant: true,
      });
      setMessages((m) => [
        ...m,
        {
          id: uid(),
          from: "bot",
          text: "",
          type: "postOrderActions",
          time: new Date().toISOString(),
        },
      ]);
      // show actions
      setMessages((m) => [
        ...m,
        {
          id: uid(),
          from: "bot",
          text: "",
          type: "orderActions",
          time: new Date().toISOString(),
        },
      ]);

      // reset
      setOrderDraft({
        medicines: [{ name: "", quantity: 1 }],
        address: "",
        deliveryOption: "pickup",
        paymentMethod: "COD",
        notes: "",
      });
      setFlow(null);
      // show menu after small delay
      setTimeout(() => showQuickActionsInChat(), 600);
    } catch (err) {
      console.error("Place order error:", err);
      const errorMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.response?.data?.reply ||
        err.message ||
        "An unexpected error occurred while placing your order.";
      pushBot(`❌ ${errorMessage}`, { type: "error", instant: true });
    } finally {
      setLoading(false);
    }
  };

  // confirm Appointment
  const confirmPlaceAppointment = async () => {
    if (!isRegistered)
      return pushBot(t(language, "registerFirst"), {
        type: "register",
        instant: true,
      });
    if (!apptDraft.date || !apptDraft.time)
      return pushBot(t(language, "pleaseFill"), {
        type: "warning",
        instant: true,
      });
    setLoading(true);
    try {
      const payload = { ...apptDraft };

      const res = await API.post("/appointments", payload);
      pushBot(res.data?.reply || t(language, "appointmentSuccess"), {
        type: "appointment",
        instant: true,
      });
      // Push confirmation card
      if (res.data?.appointment) {
        setMessages((msgs) => [
          ...msgs,
          {
            id: uid(),
            from: "bot",
            text: "",
            type: "apptCard",
            appointment: res.data.appointment,
            time: new Date().toISOString(),
          },
        ]);
      }
      // Push feedback form
      setMessages((msgs) => [
        ...msgs,
        {
          id: uid(),
          from: "bot",
          text: "",
          type: "feedbackForm",
          time: new Date().toISOString(),
        },
      ]);
      setApptDraft({
        patientName: "",
        doctorName: "Dr. Sharma",
        date: "",
        time: "",
        age: "",
        gender: "Male",
        problem: "",
      });
      setFlow(null);
      setTimeout(() => showQuickActionsInChat(), 400);
    } catch (err) {
      console.error("Appointment error:", err);
      pushBot(`❌ ${err?.response?.data?.message || err.message}`, {
        type: "error",
        instant: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // submit feedback
  const submitFeedback = async () => {
    if (!pendingFeedback || !feedbackText.trim()) return;
    setLoading(true);
    try {
      const payload = {
        orderId: pendingFeedback.orderId,
        feedback: feedbackText.trim(),
      };
      const res = await API.post("/users/feedback", payload);
      pushBot(res.data?.message || "✅ Feedback submitted successfully!", {
        type: "success",
        instant: true,
      });
      setPendingFeedback(null);
      setFeedbackText("");
      setTimeout(() => showQuickActionsInChat(), 300);
    } catch (err) {
      console.error("Feedback submit error:", err);
      pushBot(`❌ ${err?.response?.data?.message || err.message}`, {
        type: "error",
        instant: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // left-panel register (mirrors chat) -> persist
  const handleLeftRegister = async (e) => {
    e?.preventDefault();
    if (!name || !phone || !email)
      return pushBot(t(language, "pleaseFill"), {
        type: "warning",
        instant: true,
      });
    setLoading(true);
    try {
      const res = await API.post("/users/register", {
        name,
        phone,
        email,
        language,
      });

      // If backend returned token, save it and set header
      if (res.data?.token) {
        const token = res.data.token;
        localStorage.setItem("rm_token", token);
        API.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      }

      setIsRegistered(true);
      localStorage.setItem(
        "rm_user",
        JSON.stringify({ name, phone, email, language, isRegistered: true })
      );
      pushBot(res.data?.reply || t(language, "profileCreated"), {
        type: "success",
        instant: true,
      });
      setFlow(null);
      setTimeout(() => showQuickActionsInChat(), 400);
    } catch (err) {
      console.error(err);
      pushBot(
        `❌ ${
          err?.response?.data?.reply ||
          err?.response?.data?.message ||
          err.message
        }`,
        {
          type: "error",
          instant: true,
        }
      );
    } finally {
      setLoading(false);
    }
  };

  // show auth required card for non-registered users
  const showAuthRequiredCard = (type) => {
    const title =
      type === "orders"
        ? t(language, "myOrders")
        : t(language, "myAppointments");
    setMessages((m) => [
      ...m,
      {
        id: uid(),
        from: "bot",
        text: "",
        type: "authRequired",
        authType: type,
        time: new Date().toISOString(),
      },
    ]);
  };

  // fetch orders (medicine only, display in cards)
  const fetchOrdersForUser = async (showInChat = false) => {
    if (!isRegistered) {
      showAuthRequiredCard("orders");
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem("rm_token");
      let res;
      if (token) {
        res = await API.get("/users/orders");
      } else {
        res = await API.get(`/users/${phone}/orders`);
      }

      const allOrders = res.data?.orders || [];
      const orders = allOrders.filter((o) => o.type === "medicine");
      if (!orders.length) {
        pushBot(
          language === "english"
            ? "📦 You have no orders yet. Type 'Order' to place one."
            : "📦 आपके पास अभी तक कोई ऑर्डर नहीं है। 'Order' टाइप करें।",
          {
            type: "info",
            instant: true,
          }
        );
      } else if (showInChat) {
        orders.forEach((o) => {
          setMessages((m) => [
            ...m,
            {
              id: uid(),
              from: "bot",
              text: "",
              type: "orderCard",
              order: o,
              time: new Date().toISOString(),
            },
          ]);
        });

        // show actions after listing
        setMessages((m) => [
          ...m,
          {
            id: uid(),
            from: "bot",
            text: "",
            type: "orderActions",
            time: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      console.error(err);
      pushBot(`❌ ${err?.response?.data?.message || err.message}`, {
        type: "error",
        instant: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // fetch appointments (display in cards)
  const fetchAppointmentsForUser = async (showInChat = false) => {
    if (!isRegistered) {
      showAuthRequiredCard("appointments");
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem("rm_token");
      let res;
      if (token) {
        res = await API.get("/users/orders");
      } else {
        res = await API.get(`/users/${phone}/orders`);
      }

      const allOrders = res.data?.orders || [];
      const appointments = allOrders.filter((o) => o.type === "appointment");
      if (!appointments.length) {
        pushBot(
          language === "english"
            ? "📅 You have no appointments yet. Type 'Appointment' to book one."
            : "📅 आपके पास अभी तक कोई अपॉइंटमेंट नहीं है। 'Appointment' टाइप करें।",
          {
            type: "info",
            instant: true,
          }
        );
      } else if (showInChat) {
        appointments.forEach((a) => {
          setMessages((m) => [
            ...m,
            {
              id: uid(),
              from: "bot",
              text: "",
              type: "apptCard",
              appointment: a,
              time: new Date().toISOString(),
            },
          ]);
        });

        // show actions after listing
        setMessages((m) => [
          ...m,
          {
            id: uid(),
            from: "bot",
            text: "",
            type: "apptActions",
            time: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      console.error(err);
      pushBot(`❌ ${err?.response?.data?.message || err.message}`, {
        type: "error",
        instant: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // main input handler
  const handleSend = async (e) => {
    e?.preventDefault();
    const text = (userInput || "").trim();
    if (!text) return;
    pushUser(text);

    // --- NEW: If we asked the user to choose language after they said 'Hi' ---
    if (flow?.type === "chooseLanguage") {
      const detected = detectLanguage(text);
      if (!detected) {
        pushBot(t("english", "invalidLanguage"), {
          type: "error",
          instant: true,
        });
        return;
      }
      setLanguage(detected);
      setFlow(null);
      pushBot(
        `✅ Language set to ${
          detected === "hindi" ? "हिंदी" : "English"
        }. How can I help you today?`,
        { type: "success", instant: true, showQuickAfter: true }
      );
      setUserInput("");
      return;
    }

    // register flow typed responses
    if (flow?.type === "register") {
      await handleRegisterStep(text);
      setUserInput("");
      return;
    }

    const lowered = text.toLowerCase();
    if (/^[1-9]$/.test(lowered)) {
      handleChoice(lowered);
    } else if (["hi", "hello", "hey"].includes(lowered) || text === "Hi") {
      // --- NEW: on user greeting, ask language first (if not set explicitly) ---
      setFlow({ type: "chooseLanguage" });
      pushBot(
        "Which language do you prefer? Please type 'English' or 'Hindi'.",
        { type: "language", instant: true }
      );
    } else if (lowered.includes("order")) handleChoice("1");
    else if (lowered.includes("appointment") || lowered.includes("book"))
      handleChoice("2");
    else if (lowered.includes("contact")) handleChoice("contact");
    else if (lowered === "menu") showQuickActionsInChat();
    else
      pushBot(
        language === "english"
          ? "I didn't understand — type 'menu' or 'Hi' or choose 1,2,3."
          : "मुझे समझ नहीं आया — 'menu' टाइप करें या 1,2,3 चुनें।",
        { type: "info", instant: true }
      );

    setUserInput("");
  };

  // admin login success -> redirect to admin dashboard
  const handleAdminLoginSuccess = (token) => {
    localStorage.setItem("adminToken", token);
    setIsAdmin(true);
  };

  // if admin logged in, render AdminDashboard only (redirect-like)
  if (isAdmin) {
    return (
      <AdminDashboard
        onLogout={() => {
          localStorage.removeItem("adminToken");
          setIsAdmin(false);
        }}
      />
    );
  }

  // Render chat UI
  return (
    <div className={styles.wrapper} aria-live="polite">
      <aside className={`${styles.sidebar} ${menuOpen ? styles.open : ""}`}>
        <div className={styles.brand}>Ranjan Medicine</div>
        <button
          aria-label="close menu"
          className={styles.closeBtn}
          onClick={() => setMenuOpen(false)}
        >
          <FiX size={20} />
        </button>
        <div className={styles.scrollableContent}>
          <div className={styles.profile}>
            <div className={styles.avatar}>RM</div>
            <div>
              <div className={styles.pName}>
                {name || (language === "english" ? "Guest" : "अतithi")}
              </div>
              <div className={styles.pPhone}>
                {phone ||
                  (language === "english" ? "Not registered" : "रजिस्टर नहीं")}
              </div>
            </div>
          </div>

          <nav className={styles.menu}>
            <button
              className={styles.menuBtn}
              onClick={() => {
                handleChoice("1");
                setMenuOpen(false);
              }}
            >
              📦 {t(language, "orderMedicine")}
            </button>
            <button
              className={styles.menuBtn}
              onClick={() => {
                handleChoice("2");
                setMenuOpen(false);
              }}
            >
              📅 {t(language, "bookAppointment")}
            </button>
            {isRegistered && (
              <button
                className={styles.menuBtn}
                onClick={() => {
                  handleChoice("3");
                  setMenuOpen(false);
                }}
              >
                📄 {t(language, "myOrders")}
              </button>
            )}
          </nav>

          <div className={styles.divider} />

          <form className={styles.panel} onSubmit={handleLeftRegister}>
            <h4 className={styles.panelTitle}>
              {isRegistered
                ? t(language, "profileLabel")
                : t(language, "registerLabel")}
            </h4>
            <div className={styles.inputGroup}>
              <FiGlobe />
              <select
                className={styles.input}
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="english">English</option>
                <option value="hindi">हिंदी</option>
              </select>
            </div>
            <div className={styles.inputGroup}>
              <FiUser />
              <input
                className={styles.input}
                placeholder={language === "english" ? "Name" : "नाम"}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className={styles.inputGroup}>
              <FiPhone />
              <input
                className={styles.input}
                placeholder={language === "english" ? "Phone" : "फ़ोन"}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className={styles.inputGroup}>
              <FiMail />
              <input
                className={styles.input}
                placeholder={
                  language === "english"
                    ? "Email (required)"
                    : "ईमेल (अनिवार्य)"
                }
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {!isRegistered ? (
                <>
                  <button
                    className={`${styles.primary} ${styles.fullWidth}`}
                    type="submit"
                  >
                    📝 {t(language, "registerLabel")}
                  </button>

                  <button
                    type="button"
                    className={`${styles.ghost}`}
                    onClick={() => openLoginModal()}
                    style={{ alignSelf: "center" }}
                  >
                    🔑 {language === "english" ? "Login" : "लॉगिन"}
                  </button>
                </>
              ) : (
                <button
                  className={`${styles.ghost} ${styles.fullWidth}`}
                  onClick={() => handleLogout()}
                >
                  🚪 {t(language, "logoutLabel")}
                </button>
              )}
            </div>
          </form>

          <div className={styles.divider} />

          <div className={styles.panel}>
            <h4 className={styles.panelTitle}>{t(language, "contactUs")}</h4>
            <div className={styles.contactLine}>
              📧 ranjanmedicine5@gmail.com
            </div>
            <div className={styles.contactLine}>📞 +91 83692 42977</div>
          </div>

          <div className={styles.adminMini}>
            <button
              className={styles.adminMiniBtn}
              onClick={() => setFlow({ type: "admin", step: "login" })}
            >
              <FiUsers /> Admin
            </button>
          </div>

          <footer className={styles.sideFooter}>
            Made with ❤️ — Ranjan Medicine
          </footer>
        </div>
      </aside>

      <main className={styles.chatArea}>
        <header className={styles.header}>
          <button
            className={styles.hamburger}
            onClick={() => setMenuOpen(true)}
            aria-label="open menu"
          >
            <FiMenu size={22} />
          </button>
          <div className={styles.headerTitle}>Ranjan Medicine — Chat</div>
        </header>

        <section className={styles.messages}>
          {messages.map((m) => (
            <div
              key={m.id}
              className={`${styles.msg} ${
                m.from === "bot" ? styles.bot : styles.user
              }`}
            >
              <MessageBubble from={m.from} text={m.text}>
                {renderMessageContent(m)}
                {/* special small case: orderActions (buttons after order/appointments) */}
                {m.type === "orderActions" && (
                  <div className={styles.confirmRow}>
                    <button
                      className={styles.actionBtn}
                      onClick={() => fetchOrdersForUser(true)}
                    >
                      {t(language, "viewOrders")}
                    </button>
                    <button
                      className={styles.actionBtn}
                      onClick={() => goToMenuFromChat()}
                    >
                      {t(language, "backToMenu")}
                    </button>
                  </div>
                )}

                {/* timestamp under each bubble (small, subtle) */}
                <div className={styles.msgTime} aria-hidden>
                  {m.time ? new Date(m.time).toLocaleTimeString() : ""}
                </div>
              </MessageBubble>
            </div>
          ))}

          {/* typing indicator */}
          {(botTyping || loading) && (
            <div className={`${styles.msg} ${styles.bot}`}>
              <MessageBubble from="bot" text={"..."}>
                <div className={styles.typing}>● ● ●</div>
              </MessageBubble>
            </div>
          )}

          <div ref={bottomRef} />
        </section>

        <section className={styles.controls}>
          <form className={styles.inputRow} onSubmit={handleSend}>
            <input
              className={styles.mainInput}
              placeholder={
                language === "english"
                  ? "Type a message... (e.g. 'Order Paracetamol') 👇"
                  : "संदेश टाइप करें... (उदा. 'Paracetamol order') 👇"
              }
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              aria-label="Chat message"
              autoComplete="off"
            />
            <button
              className={styles.sendBtn}
              type="submit"
              disabled={!userInput.trim()}
              aria-label="send"
            >
              <FiSend />
            </button>
          </form>
        </section>
      </main>

      {/* admin modal */}
      {flow?.type === "admin" && flow.step === "login" && (
        <div className={styles.adminOverlay}>
          <div className={styles.adminBox}>
            <AdminLoginForm
              onLoginSuccess={(token) => handleAdminLoginSuccess(token)}
              onCancel={() => setFlow(null)}
            />
          </div>
        </div>
      )}

      {/* Login modal */}
      {loginOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalBox}>
            <h3>{language === "english" ? "Login" : "लॉगिन"}</h3>
            <div className={styles.inputGroup}>
              <FiPhone />
              <input
                className={styles.input}
                placeholder={language === "english" ? "Phone" : "फ़ोन"}
                value={loginPhone}
                onChange={(e) => setLoginPhone(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                className={styles.confirmBtn}
                onClick={() => loginWithPhone()}
              >
                {language === "english" ? "Login" : "लॉगिन"} <FiCheck />
              </button>
              <button
                className={styles.cancelBtn}
                onClick={() => closeLoginModal()}
              >
                {language === "english" ? "Cancel" : "रद्द करें"} <FiXCircle />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalBox}>
            <h3>
              {editModal.type === "order"
                ? language === "english"
                  ? "Edit Order"
                  : "ऑर्डर संपादित करें"
                : language === "english"
                ? "Edit Appointment"
                : "अपॉइंटमेंट संपादित करें"}
            </h3>
            {editModal.type === "order" ? (
              <div>
                {/* Dynamic medicines list */}
                {editForm.medicines.map((it, idx) => (
                  <div className={styles.chatFormRow} key={idx}>
                    <label>Medicine #{idx + 1}</label>
                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <input
                        className={styles.chatInput}
                        value={it.name}
                        onChange={(e) =>
                          setEditForm((d) => {
                            const copy = { ...d, medicines: [...d.medicines] };
                            copy.medicines[idx] = {
                              ...copy.medicines[idx],
                              name: e.target.value,
                            };
                            return copy;
                          })
                        }
                        placeholder={t(language, "medicinePlaceholder")}
                      />
                      <input
                        className={styles.chatInput}
                        style={{ width: 90 }}
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) =>
                          setEditForm((d) => {
                            const copy = { ...d, medicines: [...d.medicines] };
                            copy.medicines[idx] = {
                              ...copy.medicines[idx],
                              quantity: Number(e.target.value),
                            };
                            return copy;
                          })
                        }
                      />
                      <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={() =>
                          setEditForm((d) => {
                            const copy = {
                              ...d,
                              medicines: d.medicines.filter(
                                (_, i) => i !== idx
                              ),
                            };
                            if (!copy.medicines.length)
                              copy.medicines = [{ name: "", quantity: 1 }];
                            return copy;
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}

                <div className={styles.chatFormRow}>
                  <button
                    type="button"
                    className={styles.confirmBtn}
                    onClick={() =>
                      setEditForm((d) => ({
                        ...d,
                        medicines: [...d.medicines, { name: "", quantity: 1 }],
                      }))
                    }
                  >
                    + Add another medicine
                  </button>
                </div>

                <div className={styles.chatFormRow}>
                  <label>Delivery Option</label>
                  <select
                    className={styles.chatInput}
                    value={editForm.deliveryOption}
                    onChange={(e) =>
                      setEditForm((d) => ({
                        ...d,
                        deliveryOption: e.target.value,
                      }))
                    }
                  >
                    <option value="pickup">Pickup from Shop</option>
                    <option value="home delivery">Home Delivery</option>
                  </select>
                </div>

                {editForm.deliveryOption === "home delivery" && (
                  <div className={styles.chatFormRow}>
                    <label>Address</label>
                    <input
                      className={styles.chatInput}
                      value={editForm.address}
                      onChange={(e) =>
                        setEditForm((d) => ({ ...d, address: e.target.value }))
                      }
                      placeholder={t(language, "addressPlaceholder")}
                    />
                  </div>
                )}

                <div className={styles.chatFormRow}>
                  <label>Payment Method</label>
                  <select
                    className={styles.chatInput}
                    value={editForm.paymentMethod}
                    onChange={(e) =>
                      setEditForm((d) => ({
                        ...d,
                        paymentMethod: e.target.value,
                      }))
                    }
                  >
                    <option value="COD">Cash on Delivery (COD)</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>

                <div className={styles.chatFormRow}>
                  <label>Notes (optional)</label>
                  <textarea
                    className={styles.chatInput}
                    rows={2}
                    value={editForm.notes}
                    onChange={(e) =>
                      setEditForm((d) => ({ ...d, notes: e.target.value }))
                    }
                    placeholder={
                      language === "english"
                        ? "Any delivery instructions..."
                        : "कोई निर्देश..."
                    }
                  />
                </div>
              </div>
            ) : (
              <div>
                <div className={styles.chatFormRow}>
                  <label>Patient Name (if different from account holder)</label>
                  <input
                    className={styles.chatInput}
                    value={editForm.patientName}
                    onChange={(e) =>
                      setEditForm((s) => ({
                        ...s,
                        patientName: e.target.value,
                      }))
                    }
                    placeholder={
                      language === "english" ? "Patient Name" : "रोगी का नाम"
                    }
                  />
                </div>
                <div className={styles.chatFormRow}>
                  <label>Doctor</label>
                  <select
                    className={styles.chatInput}
                    value={editForm.doctorName}
                    onChange={(e) =>
                      setEditForm((s) => ({ ...s, doctorName: e.target.value }))
                    }
                  >
                    <option>Dr. Sharma</option>
                    <option>Dr. Verma</option>
                    <option>Dr. Gupta</option>
                  </select>
                </div>
                <div className={styles.chatFormRow}>
                  <label>Date</label>
                  <input
                    className={styles.chatInput}
                    type="date"
                    value={editForm.date}
                    onChange={(e) =>
                      setEditForm((s) => ({ ...s, date: e.target.value }))
                    }
                  />
                </div>
                <div className={styles.chatFormRow}>
                  <label>Time</label>
                  <input
                    className={styles.chatInput}
                    type="time"
                    value={editForm.time}
                    onChange={(e) =>
                      setEditForm((s) => ({ ...s, time: e.target.value }))
                    }
                  />
                </div>
                <div className={styles.chatFormRow}>
                  <label>Age</label>
                  <input
                    className={styles.chatInput}
                    value={editForm.age}
                    onChange={(e) =>
                      setEditForm((s) => ({ ...s, age: e.target.value }))
                    }
                  />
                </div>
                <div className={styles.chatFormRow}>
                  <label>Gender</label>
                  <select
                    className={styles.chatInput}
                    value={editForm.gender}
                    onChange={(e) =>
                      setEditForm((s) => ({ ...s, gender: e.target.value }))
                    }
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className={styles.chatFormRow}>
                  <label>Problem</label>
                  <input
                    className={styles.chatInput}
                    value={editForm.problem}
                    onChange={(e) =>
                      setEditForm((s) => ({ ...s, problem: e.target.value }))
                    }
                    placeholder={
                      language === "english"
                        ? "Brief description"
                        : "संक्षेप में बताएं"
                    }
                  />
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                className={styles.confirmBtn}
                onClick={() =>
                  editModal.type === "order"
                    ? handleEditOrder()
                    : handleEditAppointment()
                }
              >
                {language === "english" ? "Save" : "सेव करें"} <FiCheck />
              </button>
              <button
                className={styles.cancelBtn}
                onClick={() => {
                  setEditModal(null);
                  setEditForm({});
                }}
              >
                {language === "english" ? "Cancel" : "रद्द करें"} <FiXCircle />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirm Modal */}
      {cancelConfirm && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalBox}>
            <h3>
              {language === "english"
                ? "Confirm Cancellation"
                : "रद्द करने की पुष्टि करें"}
            </h3>
            <p>
              {language === "english"
                ? `Are you sure you want to cancel this ${cancelConfirm.type} for ${cancelConfirm.name}?`
                : `क्या आप वाकई इस ${cancelConfirm.type} को ${cancelConfirm.name} के लिए रद्द करना चाहते हैं?`}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                className={styles.confirmBtn}
                onClick={() =>
                  cancelConfirm.type === "order"
                    ? handleCancelOrder()
                    : handleCancelAppointment()
                }
              >
                {language === "english" ? "Yes" : "हाँ"} <FiCheck />
              </button>
              <button
                className={styles.cancelBtn}
                onClick={() => setCancelConfirm(null)}
              >
                {language === "english" ? "Cancel" : "रद्द करें"} <FiXCircle />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

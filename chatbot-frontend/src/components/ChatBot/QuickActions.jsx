import React from "react";
import { t } from "../../utils/locale";
import styles from "../ChatBot.module.css";

const QuickActions = ({ language, onAction, className = "" }) => (
  <div className={`${styles.quickActions} ${className}`}>
    <button className={styles.actionBtn} onClick={() => onAction("1")}>
      {t(language, "orderMedicine")}
    </button>
    <button className={styles.actionBtn} onClick={() => onAction("2")}>
      {t(language, "bookAppointment")}
    </button>
    <button className={styles.actionBtn} onClick={() => onAction("3")}>
      {t(language, "myOrders")}
    </button>
    <button className={styles.actionBtn} onClick={() => onAction("4")}>
      {t(language, "myAppointments")}
    </button>
    <button className={styles.actionBtn} onClick={() => onAction("contact")}>
      {t(language, "contactUs")}
    </button>
    <button
      className={`${styles.actionBtn} ${styles.actionBtnGhost}`}
      onClick={() => onAction("exit")}
    >
      {t(language, "exit")}
    </button>
  </div>
);

export default QuickActions;

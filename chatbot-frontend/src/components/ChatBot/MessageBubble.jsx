import React from "react";
import styles from "../ChatBot.module.css";

const MessageBubble = ({ from, text, children, className = "" }) => (
  <div
    className={`${styles.msgBubble} ${
      from === "bot" ? styles.bot : styles.user
    } ${className}`}
  >
    {text && <div className={styles.msgText}>{text}</div>}
    {children}
  </div>
);

export default MessageBubble;

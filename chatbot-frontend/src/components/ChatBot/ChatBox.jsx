import React from "react";
import styles from "../ChatBot.module.css";

const ChatBox = ({ title, children, className = "" }) => (
  <div className={`${styles.chatFormBox} ${className}`}>
    {title && <div className={styles.chatFormHeader}>{title}</div>}
    <div className={styles.chatFormBody}>{children}</div>
  </div>
);

export default ChatBox;

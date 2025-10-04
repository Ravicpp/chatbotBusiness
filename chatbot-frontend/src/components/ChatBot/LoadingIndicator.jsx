import React from "react";
import { FiLoader } from "react-icons/fi";
import styles from "../ChatBot.module.css";

const LoadingIndicator = ({ message = "Loading...", className = "" }) => (
  <div className={`${styles.loadingIndicator} ${className}`}>
    <FiLoader className={styles.spinner} />
    <span>{message}</span>
  </div>
);

export default LoadingIndicator;

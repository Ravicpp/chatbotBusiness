// src/components/Admin/AdminDashboard.jsx
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import API from "../../services/api";
import styles from "./Admin.module.css";
import {
  FiRefreshCcw,
  FiLogOut,
  FiArrowLeft,
  FiArrowRight,
  FiSearch,
  FiXCircle,
  FiTrash2,
  FiRotateCcw,
} from "react-icons/fi";

// Utility to format date for better readability
const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export default function AdminDashboard({ onLogout }) {
  // --- State Management ---
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(5); // Show 5 items per page
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [phoneQuery, setPhoneQuery] = useState(""); // Input text for phone filter
  const [filterPhone, setFilterPhone] = useState(""); // Applied filter value
  const [sidebarOpen, setSidebarOpen] = useState(false); // For mobile sidebar toggle
  const [selectedOrder, setSelectedOrder] = useState(null); // Selected order to show on detail pane

  // --- Constants/Memos ---
  const statusEmojis = useMemo(
    () => ({
      pending: "⏳ Pending",
      confirmed: "✅ Confirmed",
      shipped: "🚚 Shipped",
      delivered: "📦 Delivered",
      canceled: "❌ Canceled",
    }),
    []
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total, limit]
  );

  // --- Core Data Fetching Logic (Memoized) ---
  const fetchOrders = useCallback(async () => {
    // Show spin icon only on manual refresh or initial load
    if (page === 1 && !filterPhone && filterType === "all") {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const params = new URLSearchParams({
        page,
        limit,
        ...(filterType !== "all" && { type: filterType }),
        ...(filterStatus !== "all" && { status: filterStatus }),
        ...(filterPhone && { userPhone: filterPhone }),
      });

      const token = localStorage.getItem("adminToken");
      const res = await API.get(`/admin/orders?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setOrders(res.data.orders || []);
      setTotal(res.data.totalOrders || 0);

      // if selected order is not in new list, clear selection
      if (selectedOrder) {
        const exists = (res.data.orders || []).some(
          (o) => o.orderId === selectedOrder.orderId
        );
        if (!exists) setSelectedOrder(null);
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
      alert("⚠️ Failed to fetch orders. You might need to log in again.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [page, limit, filterType, filterStatus, filterPhone]);

  // --- Effect to trigger data fetch ---
  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchOrders]);

  // --- Filter Handlers ---
  const handlePhoneFilter = () => {
    setPage(1);
    setFilterPhone(phoneQuery.trim());
  };

  const clearPhoneFilter = () => {
    if (phoneQuery || filterPhone) {
      setPhoneQuery("");
      setPage(1);
      setFilterPhone("");
    }
  };

  // --- Action Handlers (Optimistic Updates) ---
  const updateOrderData = useCallback(
    async (userId, orderId, data, endpoint, errorMessage) => {
      const token = localStorage.getItem("adminToken");
      if (!token) return;

      const prevOrders = orders;
      // optimistic: update small fields locally (status/feedback)
      const updatedOrders = orders.map((order) =>
        order.orderId === orderId ? { ...order, ...data } : order
      );
      setOrders(updatedOrders);

      // also reflect change in selectedOrder if currently selected
      if (selectedOrder && selectedOrder.orderId === orderId) {
        setSelectedOrder({ ...selectedOrder, ...data });
      }

      try {
        await API.post(
          endpoint,
          { userId, orderId, ...data },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // If status was updated, refresh the list to ensure consistency
        if (endpoint === "/admin/order-status") {
          fetchOrders();
        }
      } catch (err) {
        console.error(errorMessage, err);
        // Show server-provided error message if available
        if (err.response && err.response.data) {
          console.error("Server response:", err.response.data);
          alert(
            `⚠️ ${errorMessage} (${
              err.response.data.message || "server error"
            })`
          );
        } else {
          alert(`⚠️ ${errorMessage}`);
        }
        setOrders(prevOrders); // rollback
      }
    },
    [orders, fetchOrders, selectedOrder]
  );

  // Specific Update Functions
  const updateStatus = (userId, orderId, status) => {
    updateOrderData(
      userId,
      orderId,
      { status },
      "/admin/order-status",
      "Failed to update status."
    );
  };

  const updateFeedback = (userId, orderId, feedback) => {
    updateOrderData(
      userId,
      orderId,
      { feedback },
      "/admin/order-feedback",
      "Failed to update feedback."
    );
  };

  // --- Hard Delete & Restore handlers ---
  const confirmAndHardDelete = async (userId, orderId) => {
    const ok = window.confirm(
      "Are you sure you want to permanently delete this order? This action cannot be undone."
    );
    if (!ok) return;

    const token = localStorage.getItem("adminToken");
    if (!token) return alert("Admin token missing. Please login again.");

    try {
      await API.delete(`/admin/orders/${userId}/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // reload list
      fetchOrders();
      alert("✅ Order permanently deleted.");
    } catch (err) {
      console.error("Failed to hard-delete order:", err);
      alert("⚠️ Failed to delete order.");
    }
  };

  const confirmAndRestore = async (userId, orderId) => {
    const ok = window.confirm("Restore this order (set to pending)?");
    if (!ok) return;

    const token = localStorage.getItem("adminToken");
    if (!token) return alert("Admin token missing. Please login again.");

    try {
      await API.post(`/admin/orders/${userId}/${orderId}/restore`, null, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchOrders();
      alert("✅ Order restored.");
    } catch (err) {
      console.error("Failed to restore order:", err);
      alert("⚠️ Failed to restore order.");
    }
  };

  // --- Pagination Handlers ---
  const goToNextPage = () => {
    setPage((p) => Math.min(p + 1, totalPages));
  };

  const goToPrevPage = () => {
    setPage((p) => Math.max(p - 1, 1));
  };

  // small helper to pick an order
  const pickOrder = (order) => {
    setSelectedOrder(order);
    // on mobile, open sidebar to view details
    if (window.innerWidth <= 900) setSidebarOpen(true);
  };

  return (
    <div className={styles.adminDashboard}>
      {/* Header */}
      <header className={styles.adminHeader}>
        <div className={styles.headerInfo}>
          <h1>🛡️ Admin Dashboard</h1>
          <p>
            Manage all{" "}
            <strong>
              {filterType === "all" ? "transactions" : filterType}
            </strong>{" "}
            ({total} total)
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.refreshBtn}
            onClick={fetchOrders}
            disabled={isRefreshing}
            title="Refresh Data"
            aria-label="Refresh orders"
          >
            <FiRefreshCcw className={isRefreshing ? styles.spin : ""} />
          </button>
          <button
            className={styles.logoutBtn}
            onClick={onLogout}
            aria-label="Logout"
          >
            <FiLogOut /> Logout
          </button>
        </div>
      </header>

      {/* Grid: Sidebar + Content */}
      <div className={styles.gridContainer}>
        {/* Sidebar: filters + selected order details (stacked) */}
        <aside
          className={styles.sidebar}
          aria-hidden={!sidebarOpen && window.innerWidth <= 900}
        >
          <button
            className={styles.sidebarToggle}
            onClick={() => setSidebarOpen((s) => !s)}
          >
            {sidebarOpen ? <FiXCircle /> : <FiSearch />} Filters
          </button>

          {/* Filters section */}
          <div style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0, marginBottom: 8, fontSize: 14 }}>
              Filters
            </h3>

            <div className={styles.filterGroup}>
              <label htmlFor="filter-type">Type:</label>
              <select
                id="filter-type"
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  setPage(1);
                }}
                className={styles.selectControl}
                disabled={loading}
              >
                <option value="all">All Transactions</option>
                <option value="order">💊 Orders Only</option>
                <option value="appointment">📅 Appointments Only</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="filter-status">Status:</label>
              <select
                id="filter-status"
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setPage(1);
                }}
                className={styles.selectControl}
                disabled={loading}
              >
                <option value="all">All Statuses</option>
                <option value="pending">⏳ Pending</option>
                <option value="confirmed">✅ Confirmed</option>
                <option value="shipped">🚚 Shipped</option>
                <option value="delivered">📦 Delivered</option>
                <option value="canceled">❌ Canceled</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="filter-phone">Phone:</label>
              <div className={styles.phoneFilterInput}>
                <input
                  id="filter-phone"
                  type="text"
                  placeholder="Filter by User Phone..."
                  value={phoneQuery}
                  onChange={(e) => setPhoneQuery(e.target.value)}
                  className={styles.inputControl}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") handlePhoneFilter();
                  }}
                  disabled={loading}
                />
                <button
                  className={styles.searchBtn}
                  onClick={handlePhoneFilter}
                  disabled={loading || phoneQuery.trim() === filterPhone}
                  title="Apply Phone Filter"
                  aria-label="Apply phone filter"
                >
                  <FiSearch />
                </button>
                {filterPhone && (
                  <button
                    className={styles.clearBtn}
                    onClick={clearPhoneFilter}
                    disabled={loading}
                    title="Clear Filter"
                    aria-label="Clear phone filter"
                  >
                    <FiXCircle />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Selected Order Details */}
          <div className={styles.detailCard}>
            <h4 style={{ marginTop: 0 }}>Details</h4>
            {selectedOrder ? (
              <div>
                <p style={{ margin: "6px 0" }}>
                  <strong>User:</strong>{" "}
                  {selectedOrder.userName || "Guest User"}
                </p>
                <p style={{ margin: "6px 0" }}>
                  <strong>Phone:</strong>{" "}
                  <a href={`tel:${selectedOrder.userPhone}`}>
                    {selectedOrder.userPhone || "N/A"}
                  </a>
                </p>

                <p style={{ margin: "6px 0" }}>
                  <strong>Type:</strong> {selectedOrder.type}
                </p>

                {selectedOrder.type === "order" ? (
                  <>
                    <p style={{ margin: "6px 0" }}>
                      <strong>Item:</strong> {selectedOrder.medicineName} (
                      {selectedOrder.quantity})
                    </p>
                    <p style={{ margin: "6px 0" }}>
                      <strong>Address:</strong> {selectedOrder.address}
                    </p>
                  </>
                ) : (
                  <>
                    <p style={{ margin: "6px 0" }}>
                      <strong>Doctor:</strong> {selectedOrder.doctorName}
                    </p>
                    <p style={{ margin: "6px 0" }}>
                      <strong>Date:</strong> {formatDate(selectedOrder.date)} at{" "}
                      {selectedOrder.time}
                    </p>
                  </>
                )}

                <p style={{ margin: "6px 0" }}>
                  <strong>Status:</strong>{" "}
                  <span
                    className={`${styles.statusBadge} ${
                      styles[selectedOrder.status] || ""
                    }`}
                  >
                    {statusEmojis[selectedOrder.status] || selectedOrder.status}
                  </span>
                </p>

                <div style={{ marginTop: 8 }}>
                  <label style={{ fontSize: 13, color: "var(--muted)" }}>
                    Change Status
                  </label>
                  <select
                    value={selectedOrder.status}
                    onChange={(e) =>
                      updateStatus(
                        selectedOrder.userId,
                        selectedOrder.orderId,
                        e.target.value
                      )
                    }
                    className={styles.statusSelect}
                    disabled={isRefreshing}
                    style={{ width: "100%", marginTop: 6 }}
                  >
                    {Object.keys(statusEmojis).map((statusKey) => (
                      <option key={statusKey} value={statusKey}>
                        {statusEmojis[statusKey].split(" ")[1]}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: 10 }}>
                  <label style={{ fontSize: 13, color: "var(--muted)" }}>
                    Admin Notes
                  </label>
                  <textarea
                    className={styles.feedbackInput}
                    value={selectedOrder.feedback || ""}
                    placeholder="Add admin notes/feedback..."
                    onChange={(e) => {
                      const newFeedback = e.target.value;
                      setSelectedOrder((prev) =>
                        prev ? { ...prev, feedback: newFeedback } : prev
                      );
                    }}
                    disabled={isRefreshing}
                    style={{ marginTop: 6 }}
                  />
                  <button
                    className={styles.refreshBtn}
                    onClick={() => {
                      if (selectedOrder) {
                        updateFeedback(
                          selectedOrder.userId,
                          selectedOrder.orderId,
                          selectedOrder.feedback || ""
                        );
                        fetchOrders();
                      }
                    }}
                    disabled={isRefreshing}
                    style={{ marginTop: 6, width: "100%" }}
                  >
                    Save Feedback
                  </button>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    className={styles.iconBtn}
                    onClick={() =>
                      confirmAndHardDelete(
                        selectedOrder.userId,
                        selectedOrder.orderId
                      )
                    }
                    title="Hard Delete (permanent)"
                  >
                    <FiTrash2 />
                  </button>
                  {selectedOrder.deleted ? (
                    <button
                      className={styles.iconBtn}
                      onClick={() =>
                        confirmAndRestore(
                          selectedOrder.userId,
                          selectedOrder.orderId
                        )
                      }
                      title="Restore order"
                    >
                      <FiRotateCcw />
                    </button>
                  ) : (
                    <div
                      style={{
                        color: "#888",
                        fontSize: 12,
                        alignSelf: "center",
                      }}
                    >
                      —
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 10 }}>
                  <button
                    className={styles.refreshBtn}
                    onClick={() => fetchOrders()}
                    disabled={isRefreshing}
                  >
                    Refresh List
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                No order selected. Click any row to view details here.
              </div>
            )}
          </div>
        </aside>

        {/* Content: list + pagination */}
        <main>
          {/* Orders Table */}
          <div className={styles.tableWrapper}>
            {loading && orders.length === 0 ? (
              <div className={styles.loadingState}>
                <FiRefreshCcw className={styles.spin} size={24} />
                <p>Fetching data...</p>
              </div>
            ) : (
              <table className={styles.orderTable}>
                <thead>
                  <tr>
                    <th>User Details</th>
                    <th>Type</th>
                    <th>Transaction Details</th>
                    <th className={styles.statusCol}>Current Status</th>
                    <th className={styles.actionCol}>Change Status</th>
                    <th className={styles.feedbackCol}>💬 Admin Feedback</th>
                    <th className={styles.adminActionCol}>Admin Actions</th>
                  </tr>
                </thead>

                <tbody className={`page-${page}`}>
                  {orders.length > 0 ? (
                    orders.map((order) => (
                      <tr
                        key={order.orderId}
                        className={`${styles[order.status] || ""} ${
                          selectedOrder &&
                          selectedOrder.orderId === order.orderId
                            ? styles.selectedRow
                            : ""
                        }`}
                        onClick={() => pickOrder(order)}
                        style={{ cursor: "pointer" }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") pickOrder(order);
                        }}
                      >
                        <td
                          data-label="User Details"
                          className={styles.userInfo}
                        >
                          <strong>{order.userName || "Guest User"}</strong>
                          <span className={styles.phoneLink}>
                            <a href={`tel:${order.userPhone}`}>
                              {order.userPhone || "N/A"}
                            </a>
                          </span>
                        </td>

                        <td data-label="Type">
                          <span
                            className={
                              order.type === "order"
                                ? styles.badgeOrder
                                : styles.badgeAppointment
                            }
                          >
                            {order.type === "order"
                              ? "💊 ORDER"
                              : "📅 APPOINTMENT"}
                          </span>
                        </td>

                        <td
                          data-label="Transaction Details"
                          className={styles.orderDetails}
                        >
                          {order.type === "order" ? (
                            <>
                              <p>
                                <strong>Item:</strong> {order.medicineName} (
                                {order.quantity})
                              </p>
                              <p>
                                <strong>Address:</strong> {order.address}
                              </p>
                              {order.prescriptionPhotoUrl && (
                                <a
                                  href={order.prescriptionPhotoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.link}
                                >
                                  📷 View Prescription
                                </a>
                              )}
                            </>
                          ) : (
                            <>
                              <p>
                                <strong>Doctor:</strong> {order.doctorName}
                              </p>
                              <p>
                                <strong>DateTime:</strong>{" "}
                                {formatDate(order.date)} at {order.time}
                              </p>
                              <p>
                                <strong>Problem:</strong>{" "}
                                {order.problem || "N/A"}
                              </p>
                            </>
                          )}
                        </td>

                        <td data-label="Current Status">
                          <span
                            className={`${styles.statusBadge} ${
                              styles[order.status] || ""
                            }`}
                          >
                            {statusEmojis[order.status] || order.status}
                          </span>
                          {order.deleted && (
                            <div
                              style={{
                                marginTop: 6,
                                color: "#b00020",
                                fontWeight: 700,
                              }}
                            >
                              ⚠️ Cancelled
                            </div>
                          )}
                        </td>

                        <td data-label="Change Status">
                          <select
                            onChange={(e) =>
                              updateStatus(
                                order.userId,
                                order.orderId,
                                e.target.value
                              )
                            }
                            value={order.status}
                            className={styles.statusSelect}
                            disabled={isRefreshing}
                            aria-label="Change order status"
                          >
                            {Object.keys(statusEmojis).map((statusKey) => (
                              <option key={statusKey} value={statusKey}>
                                {statusEmojis[statusKey].split(" ")[1]}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td data-label="Admin Feedback">
                          <textarea
                            className={styles.feedbackInput}
                            defaultValue={order.feedback || ""}
                            placeholder="Add admin notes/feedback..."
                            onBlur={(e) =>
                              updateFeedback(
                                order.userId,
                                order.orderId,
                                e.target.value.trim()
                              )
                            }
                            disabled={isRefreshing}
                            aria-label="Admin feedback"
                          />
                        </td>

                        <td data-label="Admin Actions">
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              className={styles.iconBtn}
                              title="Hard Delete (permanent)"
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmAndHardDelete(
                                  order.userId,
                                  order.orderId
                                );
                              }}
                              aria-label="Hard delete order"
                            >
                              <FiTrash2 />
                            </button>

                            {order.deleted ? (
                              <button
                                className={styles.iconBtn}
                                title="Restore order"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  confirmAndRestore(
                                    order.userId,
                                    order.orderId
                                  );
                                }}
                                aria-label="Restore order"
                              >
                                <FiRotateCcw />
                              </button>
                            ) : (
                              <div
                                style={{
                                  color: "#888",
                                  fontSize: 12,
                                  alignSelf: "center",
                                }}
                              >
                                —
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className={styles.noData}>
                        No {filterType === "all" ? "data" : filterType} found
                        matching the current filters. 🔍
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {total > 0 && (
            <div className={styles.pagination}>
              <button
                onClick={goToPrevPage}
                disabled={page === 1 || loading || isRefreshing}
                title="Previous Page"
                aria-label="Previous page"
              >
                <FiArrowLeft /> Previous
              </button>
              <span className={styles.pageInfo}>
                Page {page} of {totalPages} ({total} total items)
              </span>
              <button
                onClick={goToNextPage}
                disabled={page === totalPages || loading || isRefreshing}
                title="Next Page"
                aria-label="Next page"
              >
                Next <FiArrowRight />
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

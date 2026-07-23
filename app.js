/**
 * Mak Power Enterprise Resource Portal
 * Frontend Logic, State Management, and LocalStorage Mock Database
 */

(function () {
    // ==========================================
    // 1. STATE & MOCK DATABASE SETUP
    // ==========================================
    const DEFAULT_USERS = [
        { id: "u-1", name: "Mukesh Kumar", email: "superadmin@makpower.com", role: "superadmin", status: "active", password: "super123", avatar: "MK" },
        { id: "u-2", name: "Anand Verma", email: "admin@makpower.com", role: "admin", status: "active", password: "admin123", avatar: "AV" },
        { id: "u-3", name: "Rajesh Sharma", email: "employee@makpower.com", role: "employee", status: "active", password: "emp123", avatar: "RS" },
        { id: "u-4", name: "Pooja Patel", email: "pooja@makpower.com", role: "employee", status: "active", password: "emp123", avatar: "PP" },
        { id: "u-5", name: "Vikram Singh", email: "vikram@makpower.com", role: "employee", status: "active", password: "emp123", avatar: "VS" }
    ];

    const DEFAULT_TASKS = [
        { id: "t-1", title: "Charger Board Quality Check", desc: "Perform QC checks on the new batch of fast-charging circuits (Batch QC-2026). Ensure safety standards are met.", assigneeId: "u-3", assigneeName: "Rajesh Sharma", due: "2026-07-28", status: "progress", creator: "Anand Verma" },
        { id: "t-2", title: "Update Inventory Records", desc: "Log all inbound power bank cells into the main registry system. Double check the batch counts.", assigneeId: "u-4", assigneeName: "Pooja Patel", due: "2026-07-25", status: "pending", creator: "Anand Verma" },
        { id: "t-3", title: "Final Packaging Approval", desc: "Approve custom packing materials for the Mak Power SuperCharge series.", assigneeId: "u-3", assigneeName: "Rajesh Sharma", due: "2026-07-24", status: "completed", creator: "Anand Verma" }
    ];

    const DEFAULT_ANNOUNCEMENTS = [
        { id: "a-1", title: "System Portal Launched!", content: "Welcome to the new Mak Power Enterprise Portal. Use this system to manage work orders, update task progress, and submit daily activity reports.", date: "2026-07-23", priority: "normal" },
        { id: "a-2", title: "Safety Protocol Review", content: "All manufacturing and testing staff must attend the quarterly safety guidelines review meeting in Conference Room A tomorrow at 10:00 AM.", date: "2026-07-23", priority: "high" }
    ];

    const DEFAULT_LOGS = [
        { id: "l-1", time: "12:00:00 PM", type: "success", msg: "Database initialized with default configurations." },
        { id: "l-2", time: "12:05:30 PM", type: "info", msg: "Super Admin account pre-configured." }
    ];

    const DEFAULT_REPORTS = [
        { id: "r-1", userId: "u-3", date: "2026-07-22", text: "Completed testing of 200 fast charging circuits. Prepared inventory dispatch sheet." }
    ];

    // Core database state, loaded from the server
    let db = {
        users: [],
        tasks: [],
        announcements: [],
        logs: [],
        reports: [],
        items: [],
        orders: []
    };

    let currentUser = JSON.parse(sessionStorage.getItem("mp_active_user")) || null;
    let activePage = null;

    // Fetch database state from server
    async function syncDatabase() {
        try {
            const res = await fetch('/api/db');
            if (res.ok) {
                db = await res.json();
            } else {
                console.error("Failed to load database from server");
            }
        } catch (err) {
            console.error("Error connecting to server database", err);
        }
    }

    // Helper to persist changes (no-op since we save to DB now)
    function saveDatabase() {
        // Persisted directly to Neon database via server API
    }

    // Logger Utility (Writes to PostgreSQL via backend API)
    async function addLog(message, type = "info") {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const log = { id: "l-" + Date.now() + Math.random().toString(36).substr(2, 4), time: timeStr, type: type, msg: message };
        
        try {
            await fetch('/api/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(log)
            });
            await syncDatabase();
        } catch (err) {
            console.error("Failed to add log to server", err);
            // Local fallback
            db.logs.unshift(log);
        }
        
        // If we are currently on logs page, re-render it
        if (currentUser && currentUser.role === "superadmin" && activePage === "superadmin-logs") {
            renderLogsPage();
        }
    }

    // ==========================================
    // 2. INITIALIZATION & ROUTING
    // ==========================================
    window.addEventListener("DOMContentLoaded", async () => {
        await syncDatabase();
        initApp();
        startClock();
        lucide.createIcons();
    });

    function initApp() {
        // Form & Button Event Listeners
        document.getElementById("login-form").addEventListener("submit", handleLogin);
        document.getElementById("toggle-password").addEventListener("click", togglePasswordVisibility);
        document.getElementById("logout-btn").addEventListener("click", handleLogout);
        
        // Form submission for creating a user
        document.getElementById("create-user-form").addEventListener("submit", handleCreateUser);
        
        // Form submission for assigning task
        document.getElementById("assign-task-form").addEventListener("submit", handleAssignTask);

        // Form submission for posting announcements
        document.getElementById("post-announcement-form").addEventListener("submit", handlePostAnnouncement);

        // Form submission for daily report
        document.getElementById("submit-report-form").addEventListener("submit", handleSubmitReport);

        // Clear logs button
        document.getElementById("clear-logs-btn").addEventListener("click", handleClearLogs);

        // Download server logs button
        const downloadLogsBtn = document.getElementById("download-server-logs-btn");
        if (downloadLogsBtn) {
            downloadLogsBtn.addEventListener("click", () => {
                window.open("/api/server-logs", "_blank");
            });
        }

        // Search user binding
        document.getElementById("user-search").addEventListener("input", handleUserSearch);

        // Employee task filter buttons
        document.querySelectorAll(".task-filter-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                document.querySelectorAll(".task-filter-btn").forEach(b => b.classList.remove("active"));
                e.target.classList.add("active");
                renderEmployeeTasks(e.target.dataset.filter);
            });
        });

        // Set up Quick Login triggers
        document.querySelectorAll(".quick-login-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const target = e.currentTarget;
                document.getElementById("login-email").value = target.dataset.email;
                document.getElementById("login-password").value = target.dataset.pass;
                
                // Show a quick ripple animation
                target.style.transform = "scale(0.95)";
                setTimeout(() => target.style.transform = "scale(1)", 100);

                // Auto submit form
                document.getElementById("login-form").dispatchEvent(new Event("submit"));
            });
        });

        // Set up sidebar navigation clicks
        document.querySelectorAll(".nav-item").forEach(item => {
            item.addEventListener("click", (e) => {
                e.preventDefault();
                const targetPage = e.currentTarget.dataset.target;
                
                document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
                e.currentTarget.classList.add("active");
                
                showPage(targetPage);
            });
        });

        // Global delegation for dynamic forms
        document.addEventListener("submit", (e) => {
            if (e.target && e.target.id === "create-item-form") {
                e.preventDefault();
                handleCreateItem(e);
            }
        });

        // Check if session already exists
        if (currentUser) {
            enterPortal();
        } else {
            showSection("view-login");
        }
    }

    // Toggle view sections (Login vs Portal)
    function showSection(sectionId) {
        document.querySelectorAll(".view-section").forEach(sec => {
            sec.classList.remove("active");
        });
        const section = document.getElementById(sectionId);
        section.classList.add("active");
        
        // Scroll to top
        window.scrollTo(0, 0);
    }

    // Switch portal page views
    function showPage(pageId) {
        activePage = pageId;
        
        // Hide all pages
        document.querySelectorAll(".portal-page").forEach(page => {
            page.classList.add("hidden");
        });

        // Show targets
        const targetPageElement = document.getElementById(`page-${pageId}`);
        if (targetPageElement) {
            targetPageElement.classList.remove("hidden");
        }

        // Update titles based on page
        updateHeaderTitle(pageId);

        // Fetch data updates for page
        loadPageData(pageId);
        
        // Update Icons
        lucide.createIcons();
    }

    function updateHeaderTitle(pageId) {
        const titleEl = document.getElementById("page-title");
        const subtitleEl = document.getElementById("page-subtitle");

        switch (pageId) {
            case "superadmin-dashboard":
                titleEl.textContent = "System Analytics";
                subtitleEl.textContent = "Administrative portal performance and logs monitoring";
                break;
            case "superadmin-users":
                titleEl.textContent = "User Directory";
                subtitleEl.textContent = "Add, edit, suspend, or delete Mak Power staff accounts";
                break;
            case "superadmin-logs":
                titleEl.textContent = "System Audit Trail";
                subtitleEl.textContent = "Cryptographic audit trail of all staff activities";
                break;
            case "superadmin-items":
            case "admin-items":
                titleEl.textContent = "Item Details";
                subtitleEl.textContent = "View and manage enterprise inventory assets";
                break;
            case "superadmin-orders":
            case "admin-orders":
                titleEl.textContent = "Order Management";
                subtitleEl.textContent = "Upload existing orders and manage order schedules";
                break;
            case "admin-dashboard":
                titleEl.textContent = "Operational Control";
                subtitleEl.textContent = `Operations overview for ${currentUser.name}`;
                break;
            case "admin-tasks":
                titleEl.textContent = "Task Dispatcher";
                subtitleEl.textContent = "Assign tasks to field/manufacturing staff and inspect progress";
                break;
            case "admin-announcements":
                titleEl.textContent = "Announcements Desk";
                subtitleEl.textContent = "Publish company news and alert directives";
                break;
            case "employee-dashboard":
                titleEl.textContent = "My Assignments";
                subtitleEl.textContent = `Active task orders for ${currentUser.name}`;
                break;
            case "employee-reports":
                titleEl.textContent = "Daily Status Reports";
                subtitleEl.textContent = "Draft and submit daily activities directly to management";
                break;
        }
    }

    // Refresh data according to page
    function loadPageData(pageId) {
        switch (pageId) {
            case "superadmin-dashboard":
                renderSuperAdminMetrics();
                renderSuperAdminRecentUsers();
                break;
            case "superadmin-users":
                renderSuperAdminUserTable();
                break;
            case "superadmin-logs":
                renderLogsPage();
                break;
            case "superadmin-items":
            case "admin-items":
                renderItemsPage(pageId);
                break;
            case "superadmin-orders":
            case "admin-orders":
                renderOrdersPage(pageId);
                break;
            case "admin-dashboard":
                renderAdminMetrics();
                renderAdminTaskTracking();
                renderAdminAnnouncementsMini();
                break;
            case "admin-tasks":
                renderAdminTasksList();
                populateEmployeeDropdown();
                break;
            case "admin-announcements":
                renderAdminDetailedAnnouncements();
                break;
            case "employee-dashboard":
                renderEmployeeTasks("all");
                renderEmployeeAnnouncements();
                break;
            case "employee-reports":
                renderEmployeeReportsTable();
                break;
        }
    }

    // Real-time Clock
    function startClock() {
        const clock = document.getElementById("clock");
        const updateClock = () => {
            const now = new Date();
            clock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        };
        updateClock();
        setInterval(updateClock, 1000);
    }

    // Toast Notification Creator
    function showToast(message, type = "info") {
        const container = document.getElementById("toast-container");
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        
        let iconName = "info";
        if (type === "success") iconName = "check-circle";
        if (type === "warning") iconName = "alert-triangle";
        if (type === "error") iconName = "x-circle";

        toast.innerHTML = `
            <i data-lucide="${iconName}"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close"><i data-lucide="x"></i></button>
        `;
        
        container.appendChild(toast);
        lucide.createIcons();

        // Close button click
        toast.querySelector(".toast-close").addEventListener("click", () => {
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 200);
        });

        // Auto remove
        setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 200);
        }, 4000);
    }

    // Password visibility toggle
    function togglePasswordVisibility() {
        const passInput = document.getElementById("login-password");
        const passIcon = document.getElementById("password-toggle-icon");
        
        if (passInput.type === "password") {
            passInput.type = "text";
            passIcon.setAttribute("data-lucide", "eye-off");
        } else {
            passInput.type = "password";
            passIcon.setAttribute("data-lucide", "eye");
        }
        lucide.createIcons();
    }

    // ==========================================
    // 3. AUTHENTICATION SERVICES
    // ==========================================
    function handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById("login-email").value.trim().toLowerCase();
        const pass = document.getElementById("login-password").value;
        const submitBtn = document.getElementById("login-submit-btn");

        // UI loading state
        submitBtn.disabled = true;
        submitBtn.querySelector(".btn-text").classList.add("hidden");
        submitBtn.querySelector(".btn-loader").classList.remove("hidden");

        setTimeout(() => {
            const user = db.users.find(u => u.email.toLowerCase() === email && u.password === pass);

            if (!user) {
                showToast("Invalid email credentials or incorrect password.", "error");
                resetLoginButton();
                return;
            }

            if (user.status !== "active") {
                showToast("Your account has been suspended. Contact support.", "error");
                resetLoginButton();
                return;
            }

            // Successful login
            currentUser = user;
            sessionStorage.setItem("mp_active_user", JSON.stringify(currentUser));
            
            showToast(`Sign-in approved as ${user.name}!`, "success");
            addLog(`User ${user.name} (${user.role}) successfully logged in.`, "success");
            
            enterPortal();
            resetLoginButton();
        }, 800); // Simulated delay for premium feel
    }

    function resetLoginButton() {
        const submitBtn = document.getElementById("login-submit-btn");
        submitBtn.disabled = false;
        submitBtn.querySelector(".btn-text").classList.remove("hidden");
        submitBtn.querySelector(".btn-loader").classList.add("hidden");
    }

    function handleLogout() {
        if (currentUser) {
            addLog(`User ${currentUser.name} logged out.`, "info");
        }
        currentUser = null;
        sessionStorage.removeItem("mp_active_user");
        
        // Reset forms
        document.getElementById("login-form").reset();
        
        showToast("Signed out successfully.", "info");
        showSection("view-login");
    }

    function enterPortal() {
        // Toggle Sidebar Nav layouts based on role
        document.querySelectorAll(".role-nav").forEach(nav => nav.classList.add("hidden"));
        
        const activeRoleNav = document.getElementById(`nav-${currentUser.role}`);
        if (activeRoleNav) {
            activeRoleNav.classList.remove("hidden");
        }

        // Set sidebar user profile summaries
        document.getElementById("user-display-name").textContent = currentUser.name;
        document.getElementById("user-display-email").textContent = currentUser.email;
        document.getElementById("user-avatar").textContent = currentUser.avatar || currentUser.name.substr(0, 2).toUpperCase();

        // Style the sidebar badge appropriately
        const roleBadge = document.getElementById("user-role-badge");
        roleBadge.className = "sidebar-badge"; // reset classes
        roleBadge.classList.add(currentUser.role);
        
        let roleLabel = currentUser.role;
        if (currentUser.role === "superadmin") roleLabel = "Super Admin";
        else if (currentUser.role === "admin") roleLabel = "Admin";
        else roleLabel = "Employee";
        roleBadge.textContent = roleLabel;

        // Reset active sidebar nav highlight
        document.querySelectorAll(".nav-item").forEach(item => {
            item.classList.remove("active");
        });
        
        // Select first nav item as default and display it
        const firstNavItem = activeRoleNav.querySelector(".nav-item");
        if (firstNavItem) {
            firstNavItem.classList.add("active");
            showPage(firstNavItem.dataset.target);
        }

        showSection("view-portal");
    }

    // ==========================================
    // 4. SUPER ADMIN CONTROLS
    // ==========================================
    async function renderSuperAdminMetrics() {
        const adminCount = db.users.filter(u => u.role === "admin").length;
        const employeeCount = db.users.filter(u => u.role === "employee").length;
        const totalTasks = db.tasks.length;

        document.getElementById("stat-admins-count").textContent = adminCount;
        document.getElementById("stat-employees-count").textContent = employeeCount;
        document.getElementById("stat-total-tasks").textContent = totalTasks;

        // Update Legend details
        document.getElementById("legend-super-count").textContent = db.users.filter(u => u.role === "superadmin").length;
        document.getElementById("legend-admin-count").textContent = adminCount;
        document.getElementById("legend-emp-count").textContent = employeeCount;

        // Fetch database storage size info from Neon dynamically
        try {
            const res = await fetch('/api/storage-info');
            if (res.ok) {
                const info = await res.json();
                const availEl = document.getElementById("stat-storage-avail");
                const progressEl = document.getElementById("stat-storage-progress");
                if (availEl && progressEl) {
                    availEl.textContent = `${info.availableMb} MB`;
                    progressEl.style.width = `${info.percentageUsed}%`;
                    availEl.title = `Used: ${info.usedMb} MB / ${info.limitMb} MB (${info.percentageUsed}%)`;
                }
            }
        } catch (err) {
            console.error("Failed to load storage metrics:", err);
        }
    }

    function renderSuperAdminRecentUsers() {
        const table = document.getElementById("superadmin-recent-users-table");
        table.innerHTML = "";

        // Slice to get top 5 users (newest or first)
        const recentUsers = db.users.slice(-5).reverse();

        recentUsers.forEach(u => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="avatar" style="width:28px; height:28px; font-size:11px;">${u.avatar || u.name.substr(0, 2).toUpperCase()}</div>
                        <div>
                            <div style="font-weight:600; color:var(--color-dark);">${u.name}</div>
                            <div style="font-size:11px; color:var(--color-dark-muted);">${u.email}</div>
                        </div>
                    </div>
                </td>
                <td><span class="badge badge-${u.role}">${u.role}</span></td>
                <td><span class="badge badge-${u.status}">${u.status}</span></td>
                <td>2026-07-23</td>
            `;
            table.appendChild(tr);
        });
    }

    function renderSuperAdminUserTable(filterQuery = "") {
        const table = document.getElementById("superadmin-users-table");
        table.innerHTML = "";

        const query = filterQuery.toLowerCase();
        const filteredUsers = db.users.filter(u => 
            u.name.toLowerCase().includes(query) || 
            u.email.toLowerCase().includes(query) ||
            u.role.toLowerCase().includes(query)
        );

        if (filteredUsers.length === 0) {
            table.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--color-dark-muted);">No staff members found matching criteria.</td></tr>`;
            return;
        }

        filteredUsers.forEach(u => {
            const tr = document.createElement("tr");
            
            // Generate user-specific actions (don't allow editing self)
            let actionHtml = "";
            if (u.id === currentUser.id) {
                actionHtml = `<span style="font-size:11px; font-weight:700; color:var(--color-dark-muted); text-transform:uppercase;">Owner Session</span>`;
            } else {
                const statusBtnText = u.status === "active" ? "Suspend" : "Activate";
                const statusBtnClass = u.status === "active" ? "btn-outline" : "btn-primary";
                actionHtml = `
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-xs ${statusBtnClass} toggle-status-btn" data-id="${u.id}">${statusBtnText}</button>
                        <button class="btn btn-xs btn-outline btn-logout delete-user-btn" style="border-color: transparent;" data-id="${u.id}" title="Delete Account">
                            <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                        </button>
                    </div>
                `;
            }

            tr.innerHTML = `
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div class="avatar" style="width:30px; height:30px; font-size:11px;">${u.avatar || u.name.substr(0, 2).toUpperCase()}</div>
                        <div style="font-weight:600; color:var(--color-dark);">${u.name}</div>
                    </div>
                </td>
                <td>${u.email}</td>
                <td><span class="badge badge-${u.role}">${u.role}</span></td>
                <td><span class="badge badge-${u.status}">${u.status}</span></td>
                <td>${actionHtml}</td>
            `;

            table.appendChild(tr);
        });

        // Add action handlers dynamically
        table.querySelectorAll(".toggle-status-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                toggleUserStatus(e.target.dataset.id);
            });
        });

        table.querySelectorAll(".delete-user-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const userId = e.currentTarget.dataset.id;
                deleteUserAccount(userId);
            });
        });
        
        lucide.createIcons();
    }

    function handleUserSearch(e) {
        renderSuperAdminUserTable(e.target.value);
    }

    async function handleCreateUser(e) {
        e.preventDefault();

        const name = document.getElementById("create-name").value.trim();
        const email = document.getElementById("create-email").value.trim().toLowerCase();
        const role = document.getElementById("create-role").value;
        const pass = document.getElementById("create-password").value;

        // Validation
        if (db.users.some(u => u.email === email)) {
            showToast("A user with this email address already exists.", "error");
            return;
        }

        // Generate initials avatar
        const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().substr(0, 2);

        const newUser = {
            id: "u-" + Date.now(),
            name: name,
            email: email,
            role: role,
            status: "active",
            password: pass,
            avatar: initials
        };

        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            });
            if (!res.ok) throw new Error("Failed to create user on server");
            
            await syncDatabase();
            showToast(`Staff account for ${name} created successfully.`, "success");
            await addLog(`Super Admin created new user: ${name} (${role}).`, "success");
        } catch (err) {
            showToast("Error creating user: " + err.message, "error");
        }

        // Clear and Refresh
        document.getElementById("create-user-form").reset();
        renderSuperAdminUserTable();
    }

    async function toggleUserStatus(userId) {
        const user = db.users.find(u => u.id === userId);
        if (!user) return;

        const newStatus = user.status === "active" ? "suspended" : "active";
        
        try {
            const res = await fetch(`/api/users/${userId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (!res.ok) throw new Error("Failed to update user status");
            
            await syncDatabase();
            showToast(`User ${user.name} is now ${newStatus}.`, "success");
            await addLog(`Super Admin toggled user status for ${user.name} to ${newStatus}.`, "warning");
        } catch (err) {
            showToast("Error updating status: " + err.message, "error");
        }

        renderSuperAdminUserTable();
    }

    async function deleteUserAccount(userId) {
        const user = db.users.find(u => u.id === userId);
        if (!user) return;

        if (confirm(`Are you sure you want to delete the staff account for ${user.name}? This action is irreversible.`)) {
            try {
                const res = await fetch(`/api/users/${userId}`, {
                    method: 'DELETE'
                });
                if (!res.ok) throw new Error("Failed to delete user");
                
                await syncDatabase();
                showToast("Account deleted successfully.", "info");
                await addLog(`Super Admin deleted account of ${user.name}.`, "danger");
            } catch (err) {
                showToast("Error deleting user: " + err.message, "error");
            }

            renderSuperAdminUserTable();
        }
    }

    function renderLogsPage() {
        const logsList = document.getElementById("system-logs-list");
        logsList.innerHTML = "";

        if (db.logs.length === 0) {
            logsList.innerHTML = `<p style="text-align:center; padding: 24px; color: var(--color-dark-muted);">Audit log is currently empty.</p>`;
            return;
        }

        db.logs.forEach(log => {
            const div = document.createElement("div");
            div.className = `log-item ${log.type}`;
            div.innerHTML = `
                <span class="log-time">[${log.time}]</span>
                <span class="log-message">${log.msg}</span>
            `;
            logsList.appendChild(div);
        });
    }

    async function handleClearLogs() {
        if (confirm("Are you sure you want to purge all system logs? This cannot be undone.")) {
            try {
                const res = await fetch('/api/logs', {
                    method: 'DELETE'
                });
                if (!res.ok) throw new Error("Failed to clear system logs");
                
                await syncDatabase();
                showToast("System logs cleared.", "info");
            } catch (err) {
                showToast("Error clearing logs: " + err.message, "error");
            }
            renderLogsPage();
        }
    }

    // ==========================================
    // 5. ADMIN CONTROLS
    // ==========================================
    function renderAdminMetrics() {
        const total = db.tasks.length;
        const pending = db.tasks.filter(t => t.status === "pending" || t.status === "progress").length;
        const completed = db.tasks.filter(t => t.status === "completed").length;

        document.getElementById("admin-stat-total-tasks").textContent = total;
        document.getElementById("admin-stat-pending-tasks").textContent = pending;
        document.getElementById("admin-stat-completed-tasks").textContent = completed;
    }

    function renderAdminTaskTracking() {
        const table = document.getElementById("admin-task-progress-table");
        table.innerHTML = "";

        const sortedTasks = [...db.tasks].reverse();
        if (sortedTasks.length === 0) {
            table.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:24px; color:var(--color-dark-muted);">No tasks found. Please create one.</td></tr>`;
            return;
        }

        sortedTasks.forEach(t => {
            let statusText = "Pending Dispatch";
            if (t.status === "progress") statusText = "In Progress";
            if (t.status === "completed") statusText = "Completed";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight:600; color:var(--color-dark);">${t.title}</td>
                <td>${t.assigneeName}</td>
                <td>${t.due}</td>
                <td><span class="badge badge-${t.status}">${statusText}</span></td>
            `;
            table.appendChild(tr);
        });
    }

    function renderAdminAnnouncementsMini() {
        const list = document.getElementById("admin-announcements-mini");
        list.innerHTML = "";

        const recent = db.announcements.slice(-3).reverse();
        if (recent.length === 0) {
            list.innerHTML = `<p style="text-align:center; padding:12px; color:var(--color-dark-muted); font-size:12px;">No announcements posted.</p>`;
            return;
        }

        recent.forEach(a => {
            const card = document.createElement("div");
            card.className = `announcement-mini-card ${a.priority}`;
            card.innerHTML = `
                <div class="announce-meta">
                    <span>${a.date}</span>
                    <span style="text-transform:uppercase; color:${a.priority === 'high' ? 'var(--color-danger)' : 'var(--color-dark-muted)'}">${a.priority}</span>
                </div>
                <h4 class="announce-title">${a.title}</h4>
                <p class="announce-body">${a.content.length > 80 ? a.content.substr(0, 80) + "..." : a.content}</p>
            `;
            list.appendChild(card);
        });
    }

    function renderAdminTasksList() {
        const table = document.getElementById("admin-all-tasks-table");
        table.innerHTML = "";

        const sortedTasks = [...db.tasks].reverse();
        if (sortedTasks.length === 0) {
            table.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--color-dark-muted);">No current work orders.</td></tr>`;
            return;
        }

        sortedTasks.forEach(t => {
            let statusText = "Pending Dispatch";
            if (t.status === "progress") statusText = "In Progress";
            if (t.status === "completed") statusText = "Completed";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>
                    <div style="font-weight:700; color:var(--color-dark);">${t.title}</div>
                    <div style="font-size:12px; color:var(--color-dark-muted); margin-top:2px;">${t.desc}</div>
                </td>
                <td>${t.assigneeName}</td>
                <td>${t.due}</td>
                <td><span class="badge badge-${t.status}">${statusText}</span></td>
                <td>
                    <button class="btn btn-xs btn-logout delete-task-btn" style="border-color:transparent;" data-id="${t.id}" title="Remove Task">
                        <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                    </button>
                </td>
            `;
            table.appendChild(tr);
        });

        table.querySelectorAll(".delete-task-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const taskId = e.currentTarget.dataset.id;
                deleteTask(taskId);
            });
        });

        lucide.createIcons();
    }

    function populateEmployeeDropdown() {
        const select = document.getElementById("task-assignee");
        select.innerHTML = "";

        const employees = db.users.filter(u => u.role === "employee" && u.status === "active");
        
        if (employees.length === 0) {
            const opt = document.createElement("option");
            opt.textContent = "No active employees available";
            select.appendChild(opt);
            return;
        }

        employees.forEach(emp => {
            const opt = document.createElement("option");
            opt.value = emp.id;
            opt.textContent = emp.name;
            select.appendChild(opt);
        });
    }

    async function handleAssignTask(e) {
        e.preventDefault();

        const title = document.getElementById("task-title").value.trim();
        const desc = document.getElementById("task-desc").value.trim();
        const assigneeId = document.getElementById("task-assignee").value;
        const due = document.getElementById("task-due").value;

        const employee = db.users.find(u => u.id === assigneeId);
        if (!employee) {
            showToast("Please select a valid employee.", "error");
            return;
        }

        const newTask = {
            id: "t-" + Date.now(),
            title: title,
            desc: desc,
            assigneeId: assigneeId,
            assigneeName: employee.name,
            due: due,
            status: "pending",
            creator: currentUser.name
        };

        try {
            const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTask)
            });
            if (!res.ok) throw new Error("Failed to save task on server");
            
            await syncDatabase();
            showToast(`Task assigned successfully to ${employee.name}.`, "success");
            await addLog(`Admin (${currentUser.name}) dispatched task "${title}" to ${employee.name}.`, "info");
        } catch (err) {
            showToast("Error assigning task: " + err.message, "error");
        }

        document.getElementById("assign-task-form").reset();
        renderAdminTasksList();
    }

    async function deleteTask(taskId) {
        const task = db.tasks.find(t => t.id === taskId);
        if (!task) return;

        if (confirm(`Delete the task order "${task.title}"?`)) {
            try {
                const res = await fetch(`/api/tasks/${taskId}`, {
                    method: 'DELETE'
                });
                if (!res.ok) throw new Error("Failed to delete task on server");
                
                await syncDatabase();
                showToast("Task deleted successfully.", "info");
                await addLog(`Admin (${currentUser.name}) deleted task order "${task.title}".`, "warning");
            } catch (err) {
                showToast("Error deleting task: " + err.message, "error");
            }

            renderAdminTasksList();
        }
    }

    function renderAdminDetailedAnnouncements() {
        const container = document.getElementById("admin-announcements-feed");
        container.innerHTML = "";

        const sorted = [...db.announcements].reverse();
        if (sorted.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:32px; color:var(--color-dark-muted);">No company announcements currently on the feed.</p>`;
            return;
        }

        sorted.forEach(a => {
            const div = document.createElement("div");
            div.className = `announcement-detail-card ${a.priority}`;
            div.innerHTML = `
                <div class="header">
                    <span class="announce-meta" style="font-size:12px;">Posted on ${a.date}</span>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="badge ${a.priority === 'high' ? 'badge-suspended' : 'badge-employee'}">${a.priority} Priority</span>
                        <button class="btn btn-icon delete-announcement-btn" style="width:24px; height:24px; background:none; border:none; color:var(--color-dark-muted);" data-id="${a.id}">
                            <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                        </button>
                    </div>
                </div>
                <h3 class="announce-title" style="font-size:15px; margin-top:4px;">${a.title}</h3>
                <p class="announce-body" style="margin-top:6px; color:var(--color-dark-light); font-size:13px;">${a.content}</p>
            `;
            container.appendChild(div);
        });

        container.querySelectorAll(".delete-announcement-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const annId = e.currentTarget.dataset.id;
                deleteAnnouncement(annId);
            });
        });

        lucide.createIcons();
    }

    async function handlePostAnnouncement(e) {
        e.preventDefault();

        const title = document.getElementById("announcement-title").value.trim();
        const content = document.getElementById("announcement-content").value.trim();
        const priority = document.getElementById("announcement-priority").value;

        const date = new Date().toISOString().split('T')[0];

        const newAnnouncement = {
            id: "a-" + Date.now(),
            title: title,
            content: content,
            date: date,
            priority: priority
        };

        try {
            const res = await fetch('/api/announcements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAnnouncement)
            });
            if (!res.ok) throw new Error("Failed to save announcement on server");
            
            await syncDatabase();
            showToast("Company announcement posted successfully.", "success");
            await addLog(`Admin (${currentUser.name}) posted new announcement: "${title}".`, "info");
        } catch (err) {
            showToast("Error posting announcement: " + err.message, "error");
        }

        document.getElementById("post-announcement-form").reset();
        renderAdminDetailedAnnouncements();
    }

    async function deleteAnnouncement(annId) {
        const item = db.announcements.find(a => a.id === annId);
        if (!item) return;

        if (confirm(`Remove the announcement: "${item.title}"?`)) {
            try {
                const res = await fetch(`/api/announcements/${annId}`, {
                    method: 'DELETE'
                });
                if (!res.ok) throw new Error("Failed to delete announcement on server");
                
                await syncDatabase();
                showToast("Announcement removed.", "info");
                await addLog(`Admin (${currentUser.name}) deleted announcement: "${item.title}".`, "warning");
            } catch (err) {
                showToast("Error deleting announcement: " + err.message, "error");
            }

            renderAdminDetailedAnnouncements();
        }
    }

    // ==========================================
    // 6. EMPLOYEE CONTROLS
    // ==========================================
    function renderEmployeeTasks(filter = "all") {
        const container = document.getElementById("employee-task-list");
        container.innerHTML = "";

        // Filter tasks assigned to current employee
        let myTasks = db.tasks.filter(t => t.assigneeId === currentUser.id);

        if (filter === "pending") {
            myTasks = myTasks.filter(t => t.status === "pending");
        } else if (filter === "progress") {
            myTasks = myTasks.filter(t => t.status === "progress");
        } else if (filter === "completed") {
            myTasks = myTasks.filter(t => t.status === "completed");
        }

        if (myTasks.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:32px; background:var(--bg-hover); border-radius:var(--radius-md); border: 1px dashed var(--border-color);">
                    <i data-lucide="inbox" style="width:40px; height:40px; color:var(--color-dark-muted); margin-bottom:8px;"></i>
                    <p style="color:var(--color-dark-muted); font-size:13px; font-weight:600;">No tasks found in this section.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        myTasks.reverse().forEach(t => {
            const card = document.createElement("div");
            card.className = "task-card";
            
            let statusText = "Pending Start";
            if (t.status === "progress") statusText = "In Progress";
            if (t.status === "completed") statusText = "Completed";

            let actionButtonsHtml = "";
            if (t.status === "pending") {
                actionButtonsHtml = `
                    <button class="btn btn-xs btn-primary task-state-btn" data-id="${t.id}" data-action="progress">
                        <i data-lucide="play" style="width:12px; height:12px;"></i> Start Work
                    </button>
                `;
            } else if (t.status === "progress") {
                actionButtonsHtml = `
                    <button class="btn btn-xs btn-outline task-state-btn" data-id="${t.id}" data-action="completed" style="border-color:var(--color-success); color:var(--color-success);">
                        <i data-lucide="check" style="width:12px; height:12px;"></i> Complete Task
                    </button>
                `;
            } else {
                actionButtonsHtml = `<span style="font-size:12px; font-weight:600; color:var(--color-success); display:flex; align-items:center; gap:4px;"><i data-lucide="check-circle" style="width:14px; height:14px;"></i> Done</span>`;
            }

            card.innerHTML = `
                <div class="task-card-header">
                    <h3 class="task-card-title">${t.title}</h3>
                    <span class="badge badge-${t.status}">${statusText}</span>
                </div>
                <p class="task-card-desc">${t.desc}</p>
                <div class="task-card-footer">
                    <div class="task-card-due">
                        <i data-lucide="calendar"></i>
                        <span>Due: ${t.due}</span>
                    </div>
                    <div class="task-actions">
                        ${actionButtonsHtml}
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

        // Add action triggers
        container.querySelectorAll(".task-state-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const target = e.currentTarget;
                updateTaskStatus(target.dataset.id, target.dataset.action);
            });
        });

        lucide.createIcons();
    }

    async function updateTaskStatus(taskId, action) {
        const task = db.tasks.find(t => t.id === taskId);
        if (!task) return;

        try {
            const res = await fetch(`/api/tasks/${taskId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: action })
            });
            if (!res.ok) throw new Error("Failed to update status on server");
            
            await syncDatabase();
            const actionText = action === "progress" ? "marked as In Progress" : "completed";
            showToast(`Task was successfully ${actionText}.`, "success");
            await addLog(`Employee (${currentUser.name}) updated task status of "${task.title}" to ${action}.`, "info");
        } catch (err) {
            showToast("Error updating task status: " + err.message, "error");
        }

        // Re-render task board based on active filter
        const activeFilterBtn = document.querySelector(".task-filter-btn.active");
        const filter = activeFilterBtn ? activeFilterBtn.dataset.filter : "all";
        renderEmployeeTasks(filter);
    }

    function renderEmployeeAnnouncements() {
        const list = document.getElementById("employee-announcements");
        list.innerHTML = "";

        const sorted = [...db.announcements].reverse();
        if (sorted.length === 0) {
            list.innerHTML = `<p style="text-align:center; padding:12px; color:var(--color-dark-muted); font-size:12px;">No company announcements posted.</p>`;
            return;
        }

        sorted.forEach(a => {
            const card = document.createElement("div");
            card.className = `announcement-mini-card ${a.priority}`;
            card.innerHTML = `
                <div class="announce-meta">
                    <span>${a.date}</span>
                    <span style="text-transform:uppercase; color:${a.priority === 'high' ? 'var(--color-danger)' : 'var(--color-dark-muted)'}">${a.priority} Priority</span>
                </div>
                <h4 class="announce-title">${a.title}</h4>
                <p class="announce-body">${a.content}</p>
            `;
            list.appendChild(card);
        });
    }

    function renderEmployeeReportsTable() {
        const table = document.getElementById("employee-reports-table");
        table.innerHTML = "";

        const myReports = db.reports.filter(r => r.userId === currentUser.id).reverse();

        if (myReports.length === 0) {
            table.innerHTML = `<tr><td colspan="2" style="text-align:center; padding:24px; color:var(--color-dark-muted);">No reports submitted yet. Submit your first daily report.</td></tr>`;
            return;
        }

        myReports.forEach(r => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight:700; color:var(--color-dark); white-space:nowrap; width:150px;">${r.date}</td>
                <td style="color:var(--color-dark-light); line-height:1.4;">${r.text}</td>
            `;
            table.appendChild(tr);
        });
    }

    async function handleSubmitReport(e) {
        e.preventDefault();

        const reportText = document.getElementById("report-text").value.trim();
        const date = new Date().toISOString().split('T')[0];

        const newReport = {
            id: "r-" + Date.now(),
            userId: currentUser.id,
            date: date,
            text: reportText
        };

        try {
            const res = await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newReport)
            });
            if (!res.ok) throw new Error("Failed to submit report on server");
            
            await syncDatabase();
            showToast("Daily status report logged successfully.", "success");
            await addLog(`Employee (${currentUser.name}) logged daily status report.`, "info");
            document.getElementById("report-text").value = "";
            renderEmployeeReportsTable();
        } catch (err) {
            showToast("Error submitting report: " + err.message, "error");
        }
    }

    // ==========================================
    // 7. ITEM MANAGEMENT PAGE & LOGIC
    // ==========================================
    // ==========================================
    // 7. ITEM MANAGEMENT PAGE & LOGIC
    // ==========================================
    function getCategoryOptionsHtml() {
        let categories = [...new Set(db.items.map(item => item.category))].filter(Boolean);
        if (categories.length === 0) {
            categories = ['Chargers', 'Cables', 'Power Banks', 'Packaging', 'Raw Material', 'Others'];
        }
        return categories.map(cat => `<option value="${cat}">${cat}</option>`).join('\n');
    }

    async function handleCreateItem(e) {
        const nameInput = document.getElementById("item-name-input");
        const categoryInput = document.getElementById("item-category-input");
        
        const name = nameInput.value.trim();
        const category = categoryInput.value;

        if (!name) {
            showToast("Item name is required.", "error");
            return;
        }

        if (db.items.some(item => item.name.toLowerCase() === name.toLowerCase())) {
            showToast("Item with this name already exists in the database.", "error");
            return;
        }

        const newItem = {
            name: name,
            category: category
        };

        try {
            const res = await fetch('/api/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newItem)
            });
            
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to create item");
            }
            
            await syncDatabase();
            showToast(`Item "${name}" created successfully.`, "success");
            await addLog(`User (${currentUser.name}) manually added item "${name}".`, "success");
            
            nameInput.value = "";
            
            // Re-render select dropdown values and table rows
            const selectElement = document.getElementById("item-category-input");
            if (selectElement) {
                selectElement.innerHTML = getCategoryOptionsHtml();
            }
            renderItemsTableRows();
        } catch (err) {
            showToast(err.message, "error");
        }
    }

    function renderItemsPage(pageId) {
        const container = document.getElementById(`page-${pageId}`);
        if (!container) return;

        container.innerHTML = `
            <div class="dashboard-grid">
                <!-- Add / Upload Card -->
                <div class="panel-card col-4">
                    <div class="panel-header">
                        <h2>Add Inventory Item</h2>
                    </div>
                    <div class="panel-body">
                        <!-- Manual Form -->
                        <form id="create-item-form" style="margin-bottom: 24px;">
                            <div class="form-group">
                                <label for="item-name-input">Item Name</label>
                                <input type="text" id="item-name-input" required class="form-control" placeholder="e.g. Mak Fast Charger 20W">
                            </div>
                            <div class="form-group">
                                <label for="item-category-input">Category</label>
                                <select id="item-category-input" class="form-control">
                                    ${getCategoryOptionsHtml()}
                                </select>
                            </div>
                            <button type="submit" class="btn btn-primary btn-block">
                                <i data-lucide="plus-circle"></i> Add Item
                            </button>
                        </form>

                        <div style="border-top: 1px dashed var(--color-border); margin: 20px 0;"></div>

                        <!-- Bulk Excel Upload -->
                        <div>
                            <h3 style="font-size: 14px; margin-bottom: 8px; font-weight:600;">Bulk Import via Excel</h3>
                            <p style="font-size: 12px; color: var(--color-dark-muted); margin-bottom: 12px;">
                                Upload an Excel file with columns: <strong>Item Name</strong> and <strong>Category</strong>. IDs will be auto-assigned.
                            </p>
                            <div class="form-group">
                                <input type="file" id="item-excel-file" accept=".xlsx, .xls, .csv" class="form-control" style="padding: 4px 8px;">
                            </div>
                            <button id="import-items-excel-btn" class="btn btn-secondary btn-block" disabled>
                                <i data-lucide="upload"></i> Upload & Import
                            </button>
                            <div id="items-excel-preview" style="margin-top: 12px; font-size:12px; font-weight:600;"></div>
                        </div>
                    </div>
                </div>

                <!-- Directory Card -->
                <div class="panel-card col-8">
                    <div class="panel-header" style="display:flex; justify-content:space-between; align-items:center;">
                        <h2>Items Directory</h2>
                        <div class="search-box-container" style="width: 250px;">
                            <input type="text" id="items-search-input" class="form-control" placeholder="Search by name or category..." style="padding: 6px 12px; font-size: 13px;">
                        </div>
                    </div>
                    <div class="panel-body">
                        <div class="table-responsive">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Item Name (Click for History)</th>
                                        <th>Category</th>
                                        <th style="text-align: right;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="items-table-body">
                                    <!-- Dynamic rows -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

        renderItemsTableRows();

        const fileInput = document.getElementById("item-excel-file");
        const importBtn = document.getElementById("import-items-excel-btn");
        const previewDiv = document.getElementById("items-excel-preview");

        let parsedItems = [];

        fileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) {
                importBtn.disabled = true;
                previewDiv.textContent = "";
                return;
            }

            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = new Uint8Array(evt.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const json = XLSX.utils.sheet_to_json(firstSheet);
                    
                    parsedItems = json.map(row => {
                        const nameKey = Object.keys(row).find(k => k.toLowerCase().replace(/[\s_]/g, '') === 'itemname');
                        const categoryKey = Object.keys(row).find(k => k.toLowerCase() === 'category');
                        
                        return {
                            name: (row[nameKey] || row['Item Name'] || row['name'] || '').toString().trim(),
                            category: (row[categoryKey] || row['Category'] || row['category'] || 'Others').toString().trim()
                        };
                    }).filter(item => item.name);

                    if (parsedItems.length === 0) {
                        previewDiv.textContent = "No valid item rows found.";
                        previewDiv.style.color = "var(--color-danger)";
                        importBtn.disabled = true;
                    } else {
                        previewDiv.textContent = `Found ${parsedItems.length} items ready to import.`;
                        previewDiv.style.color = "var(--color-success)";
                        importBtn.disabled = false;
                    }
                } catch (err) {
                    console.error(err);
                    previewDiv.textContent = "Error parsing Excel file.";
                    previewDiv.style.color = "var(--color-danger)";
                    importBtn.disabled = true;
                }
            };
            reader.readAsArrayBuffer(file);
        });

        importBtn.addEventListener("click", async () => {
            if (parsedItems.length === 0) return;
            importBtn.disabled = true;
            importBtn.textContent = "Importing...";
            
            try {
                const res = await fetch('/api/items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(parsedItems)
                });
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || "Failed to save imported items on server");
                }
                
                await syncDatabase();
                showToast(`Successfully imported ${parsedItems.length} items.`, "success");
                await addLog(`User (${currentUser.name}) bulk imported ${parsedItems.length} items from Excel.`, "info");
                
                fileInput.value = "";
                previewDiv.textContent = "";
                
                // Re-render select dropdown values and table rows
                const selectElement = document.getElementById("item-category-input");
                if (selectElement) {
                    selectElement.innerHTML = getCategoryOptionsHtml();
                }
                renderItemsTableRows();
            } catch (err) {
                showToast("Import error: " + err.message, "error");
            } finally {
                importBtn.disabled = false;
                importBtn.innerHTML = '<i data-lucide="upload"></i> Upload & Import';
                lucide.createIcons();
            }
        });

        const searchInput = document.getElementById("items-search-input");
        searchInput.addEventListener("input", () => {
            renderItemsTableRows(searchInput.value.trim().toLowerCase());
        });

        lucide.createIcons();
    }

    function renderItemsTableRows(filterQuery = "") {
        const tbody = document.getElementById("items-table-body");
        if (!tbody) return;
        tbody.innerHTML = "";

        let filteredItems = db.items;
        if (filterQuery) {
            filteredItems = db.items.filter(item => 
                String(item.id).toLowerCase().includes(filterQuery) ||
                item.name.toLowerCase().includes(filterQuery) ||
                item.category.toLowerCase().includes(filterQuery)
            );
        }

        if (filteredItems.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 24px; color: var(--color-dark-muted);">No items found. Add items to get started.</td></tr>`;
            return;
        }

        filteredItems.forEach(item => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight:700; font-family: monospace; color:var(--color-primary);">${item.id}</td>
                <td>
                    <a href="#" class="item-history-link" data-id="${item.id}" data-name="${item.name}" style="font-weight:600; color:var(--color-dark); text-decoration:none; border-bottom:1px dashed var(--color-primary); display:inline-block; cursor:pointer;">
                        ${item.name}
                    </a>
                </td>
                <td><span class="badge" style="background:var(--color-border); color:var(--color-dark-light);">${item.category}</span></td>
                <td style="text-align: right; white-space:nowrap;">
                    <button class="btn btn-icon edit-item-btn" data-id="${item.id}" style="width:28px; height:28px; padding:0; background:none; border:none; color:var(--color-primary); margin-right:8px; cursor:pointer;">
                        <i data-lucide="edit-3" style="width:16px; height:16px;"></i>
                    </button>
                    <button class="btn btn-icon delete-item-btn" data-id="${item.id}" style="width:28px; height:28px; padding:0; background:none; border:none; color:var(--color-danger); cursor:pointer;">
                        <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Click handler to view item history timeline modal
        tbody.querySelectorAll(".item-history-link").forEach(link => {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                const id = e.currentTarget.dataset.id;
                const name = e.currentTarget.dataset.name;
                openItemHistoryModal(id, name);
            });
        });

        // Click handler to edit item
        tbody.querySelectorAll(".edit-item-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = e.currentTarget.dataset.id;
                const item = db.items.find(i => String(i.id) === String(id));
                if (item) {
                    openEditItemModal(item);
                }
            });
        });

        tbody.querySelectorAll(".delete-item-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const id = e.currentTarget.dataset.id;
                const item = db.items.find(i => String(i.id) === String(id));
                if (!item) return;

                if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
                    try {
                        const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
                        if (!res.ok) throw new Error("Failed to delete item on server");
                        await syncDatabase();
                        showToast(`Deleted item "${item.name}".`, "info");
                        await addLog(`User (${currentUser.name}) deleted item "${item.name}" (${id}).`, "warning");
                        
                        // Re-render select dropdown values and table rows
                        const selectElement = document.getElementById("item-category-input");
                        if (selectElement) {
                            selectElement.innerHTML = getCategoryOptionsHtml();
                        }
                        renderItemsTableRows(document.getElementById("items-search-input").value.trim().toLowerCase());
                    } catch (err) {
                        showToast("Delete error: " + err.message, "error");
                    }
                }
            });
        });

        lucide.createIcons();
    }

    function openItemHistoryModal(itemId, itemName) {
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";
        
        overlay.innerHTML = `
            <div class="modal-card">
                <div class="modal-header">
                    <h3>Item Audit History: ${itemName} (ID: ${itemId})</h3>
                    <button class="modal-close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="history-timeline" id="history-timeline-container">
                        <p style="text-align:center; padding:20px; color:var(--color-dark-muted);">Loading history...</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        fetch(`/api/items/${itemId}/history`)
            .then(res => {
                if (!res.ok) throw new Error("Failed to load history");
                return res.json();
            })
            .then(data => {
                const container = document.getElementById("history-timeline-container");
                if (data.length === 0) {
                    container.innerHTML = `<p style="text-align:center; padding:20px; color:var(--color-dark-muted);">No history logs found for this item.</p>`;
                    return;
                }
                
                container.innerHTML = data.map(log => {
                    const formattedDate = new Date(log.timestamp).toLocaleString();
                    let dotColor = 'var(--color-info)';
                    if (log.action === 'create') dotColor = 'var(--color-success)';
                    if (log.action === 'delete') dotColor = 'var(--color-danger)';
                    if (log.action === 'update') dotColor = 'var(--color-warning)';
                    
                    return `
                        <div class="timeline-item">
                            <div class="timeline-dot" style="background:${dotColor};"></div>
                            <div class="timeline-meta">${formattedDate} &bull; <strong>${log.action.toUpperCase()}</strong></div>
                            <div class="timeline-desc">${log.details}</div>
                        </div>
                    `;
                }).join('');
            })
            .catch(err => {
                const container = document.getElementById("history-timeline-container");
                container.innerHTML = `<p style="text-align:center; padding:20px; color:var(--color-danger);">${err.message}</p>`;
            });
            
        const closeBtn = overlay.querySelector(".modal-close-btn");
        closeBtn.addEventListener("click", () => overlay.remove());
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    function openEditItemModal(item) {
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";
        
        overlay.innerHTML = `
            <div class="modal-card">
                <div class="modal-header">
                    <h3>Edit Item Details</h3>
                    <button class="modal-close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="edit-item-modal-form">
                        <div class="form-group">
                            <label for="edit-item-name">Item Name</label>
                            <input type="text" id="edit-item-name" class="form-control" required value="${item.name}">
                        </div>
                        <div class="form-group">
                            <label for="edit-item-category">Category</label>
                            <select id="edit-item-category" class="form-control">
                                ${getCategoryOptionsHtml()}
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary btn-block" style="margin-top:16px;">
                            Save Changes
                        </button>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        const categorySelect = overlay.querySelector("#edit-item-category");
        categorySelect.value = item.category;
        
        const closeBtn = overlay.querySelector(".modal-close-btn");
        closeBtn.addEventListener("click", () => overlay.remove());
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) overlay.remove();
        });
        
        const form = overlay.querySelector("#edit-item-modal-form");
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const newName = overlay.querySelector("#edit-item-name").value.trim();
            const newCat = categorySelect.value;
            
            if (!newName) {
                showToast("Item name is required.", "error");
                return;
            }
            
            try {
                const res = await fetch(`/api/items/${item.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newName, category: newCat })
                });
                
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || "Failed to update item details");
                }
                
                const resData = await res.json();
                await syncDatabase();
                showToast("Item updated successfully.", "success");
                
                if (resData.changes && resData.changes.length > 0) {
                    await addLog(`User (${currentUser.name}) edited item ID ${item.id}: ${resData.changes.join(', ')}`, "info");
                }
                
                overlay.remove();
                
                // Refresh directory
                const searchVal = document.getElementById("items-search-input") ? document.getElementById("items-search-input").value.trim().toLowerCase() : "";
                renderItemsTableRows(searchVal);
                
                // Re-render items page select dropdown dynamic values
                const selectElement = document.getElementById("item-category-input");
                if (selectElement) {
                    selectElement.innerHTML = getCategoryOptionsHtml();
                }
            } catch (err) {
                showToast(err.message, "error");
            }
        });
    }

    // ==========================================
    // 8. ORDERS MANAGEMENT PAGE & LOGIC
    // ==========================================
    function renderOrdersPage(pageId) {
        const container = document.getElementById(`page-${pageId}`);
        if (!container) return;

        container.innerHTML = `
            <div class="dashboard-grid">
                <!-- Excel Import Card -->
                <div class="panel-card col-4">
                    <div class="panel-header">
                        <h2>Upload Orders (Excel)</h2>
                    </div>
                    <div class="panel-body">
                        <p style="font-size: 13px; color: var(--color-dark-muted); margin-bottom: 16px;">
                            Upload an Excel file containing orders. The columns in the file must map to:
                            <br>
                            <code>Item Name</code>, <code>Qty</code>, <code>AMT</code>, <code>Date</code>, <code>Party Name</code>, <code>Order NO</code>, <code>Remarks&Timestamp</code>, <code>Id</code>
                        </p>
                        
                        <div class="form-group">
                            <input type="file" id="orders-excel-file" accept=".xlsx, .xls, .csv" class="form-control" style="padding: 4px 8px;">
                        </div>
                        <button id="import-orders-excel-btn" class="btn btn-primary btn-block" disabled>
                            <i data-lucide="upload-cloud"></i> Parse & Save Orders
                        </button>
                        <div id="orders-excel-preview" style="margin-top: 14px; font-size:13px; font-weight:600;"></div>
                    </div>
                </div>

                <!-- Orders List Card -->
                <div class="panel-card col-8">
                    <div class="panel-header" style="display:flex; justify-content:space-between; align-items:center;">
                        <h2>Orders Directory</h2>
                        <div class="search-box-container" style="width: 250px;">
                            <input type="text" id="orders-search-input" class="form-control" placeholder="Search Party or Order NO..." style="padding: 6px 12px; font-size: 13px;">
                        </div>
                    </div>
                    <div class="panel-body">
                        <div class="table-responsive">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Order NO</th>
                                        <th>Item Name</th>
                                        <th>Qty</th>
                                        <th>AMT (Scheme)</th>
                                        <th>Date</th>
                                        <th>Party Name</th>
                                        <th>Remarks</th>
                                        <th style="text-align: right;">Action</th>
                                    </tr>
                                </thead>
                                <tbody id="orders-table-body">
                                    <!-- Dynamic rows -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

        renderOrdersPageHandlers();
        lucide.createIcons();
    }

    function renderOrdersPageHandlers() {
        const fileInput = document.getElementById("orders-excel-file");
        const importBtn = document.getElementById("import-orders-excel-btn");
        const previewDiv = document.getElementById("orders-excel-preview");
        if (!fileInput || !importBtn || !previewDiv) return;

        let parsedOrders = [];

        fileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) {
                importBtn.disabled = true;
                previewDiv.textContent = "";
                return;
            }

            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = new Uint8Array(evt.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const json = XLSX.utils.sheet_to_json(firstSheet);
                    
                    parsedOrders = json.map(row => {
                        const findKey = (candidates) => {
                            return Object.keys(row).find(k => 
                                candidates.includes(k.toLowerCase().replace(/[\s_&]/g, ''))
                            );
                        };

                        const itemKey = findKey(['itemname', 'item']);
                        const qtyKey = findKey(['qty', 'quantity']);
                        const amtKey = findKey(['amt', 'amount', 'scheme']);
                        const dateKey = findKey(['date', 'orderdate']);
                        const partyKey = findKey(['partyname', 'party']);
                        const orderNoKey = findKey(['orderno', 'ordernumber']);
                        const remarksKey = findKey(['remarkstimestamp', 'remarks', 'timestamp']);
                        const idKey = findKey(['id', 'orderid']);

                        return {
                            id: (row[idKey] || row['Id'] || '').toString().trim() || ('O-' + Date.now() + Math.random().toString(36).substr(2, 4)),
                            itemName: (row[itemKey] || row['Item Name'] || '').toString().trim(),
                            qty: parseInt(row[qtyKey] || row['Qty'] || 0, 10),
                            amt: (row[amtKey] || row['AMT'] || '').toString().trim(),
                            date: (row[dateKey] || row['Date'] || new Date().toISOString().split('T')[0]).toString().trim(),
                            partyName: (row[partyKey] || row['Party Name'] || '').toString().trim(),
                            orderNo: (row[orderNoKey] || row['Order NO'] || '').toString().trim(),
                            remarksTimestamp: (row[remarksKey] || row['Remarks&Timestamp'] || '').toString().trim()
                        };
                    }).filter(ord => ord.itemName && ord.partyName);

                    if (parsedOrders.length === 0) {
                        previewDiv.textContent = "No valid orders found in file.";
                        previewDiv.style.color = "var(--color-danger)";
                        importBtn.disabled = true;
                    } else {
                        previewDiv.textContent = `${parsedOrders.length} orders loaded from file.`;
                        previewDiv.style.color = "var(--color-success)";
                        importBtn.disabled = false;
                    }
                } catch (err) {
                    console.error(err);
                    previewDiv.textContent = "Failed to parse Excel file.";
                    previewDiv.style.color = "var(--color-danger)";
                    importBtn.disabled = true;
                }
            };
            reader.readAsArrayBuffer(file);
        });

        importBtn.addEventListener("click", async () => {
            if (parsedOrders.length === 0) return;
            importBtn.disabled = true;
            importBtn.textContent = "Saving...";

            try {
                const res = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(parsedOrders)
                });
                if (!res.ok) throw new Error("Failed to save orders on server");

                await syncDatabase();
                showToast(`Successfully saved ${parsedOrders.length} orders!`, "success");
                await addLog(`User (${currentUser.name}) uploaded and saved ${parsedOrders.length} orders via Excel.`, "info");

                fileInput.value = "";
                previewDiv.textContent = "";
                renderOrdersTableRows();
            } catch (err) {
                showToast("Save error: " + err.message, "error");
            } finally {
                importBtn.disabled = false;
                importBtn.innerHTML = '<i data-lucide="upload-cloud"></i> Parse & Save Orders';
                lucide.createIcons();
            }
        });

        const searchInput = document.getElementById("orders-search-input");
        if (searchInput) {
            searchInput.addEventListener("input", () => {
                renderOrdersTableRows(searchInput.value.trim().toLowerCase());
            });
        }
    }

    function formatRemarksTimestamp(text) {
        if (!text) return '<span style="color:var(--color-dark-muted);">—</span>';
        
        let remarks = text;
        let details = '';
        let timestamp = '';
        
        if (text.includes('^')) {
            const parts = text.split('^');
            remarks = parts[0].trim();
            timestamp = parts[1].trim();
        }
        
        if (remarks.includes('@@')) {
            const parts = remarks.split('@@');
            remarks = parts[0].trim();
            details = parts[1].trim();
        }
        
        let html = `<div style="font-weight:600; color:var(--color-dark);">${remarks}</div>`;
        if (details) {
            html += `<div style="font-size:11px; color:var(--color-dark-light); margin-top:2px;">${details}</div>`;
        }
        if (timestamp) {
            html += `<div style="font-size:10px; font-family:monospace; color:var(--color-primary); margin-top:4px;">${timestamp}</div>`;
        }
        return html;
    }

    function renderOrdersTableRows(filterQuery = "") {
        const tbody = document.getElementById("orders-table-body");
        if (!tbody) return;
        tbody.innerHTML = "";

        let filteredOrders = db.orders;
        if (filterQuery) {
            filteredOrders = db.orders.filter(ord => 
                ord.id.toLowerCase().includes(filterQuery) ||
                ord.orderNo.toLowerCase().includes(filterQuery) ||
                ord.itemName.toLowerCase().includes(filterQuery) ||
                ord.partyName.toLowerCase().includes(filterQuery)
            );
        }

        if (filteredOrders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color: var(--color-dark-muted);">No orders found. Import your first Excel sheet.</td></tr>`;
            return;
        }

        filteredOrders.forEach(ord => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-family: monospace; font-size:11px; color: var(--color-dark-muted);">${ord.id}</td>
                <td style="font-weight:700; color: var(--color-dark);">${ord.orderNo}</td>
                <td style="font-weight:600; color: var(--color-primary);">${ord.itemName}</td>
                <td><span style="font-weight:700; color:var(--color-dark);">${ord.qty}</span></td>
                <td><span class="badge ${ord.amt.toLowerCase().includes('not') ? 'badge-suspended' : 'badge-success'}">${ord.amt}</span></td>
                <td style="white-space:nowrap;">${ord.date}</td>
                <td style="font-weight:600; color: var(--color-dark-light);">${ord.partyName}</td>
                <td style="max-width:220px; vertical-align:top; padding:10px 16px;">${formatRemarksTimestamp(ord.remarksTimestamp)}</td>
                <td style="text-align: right;">
                    <button class="btn btn-icon delete-order-btn" data-id="${ord.id}" style="width:28px; height:28px; padding:0; background:none; border:none; color:var(--color-danger);">
                        <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll(".delete-order-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const id = e.currentTarget.dataset.id;
                const ord = db.orders.find(o => o.id === id);
                if (!ord) return;

                if (confirm(`Remove order "${ord.orderNo}" for ${ord.partyName}?`)) {
                    try {
                        const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
                        if (!res.ok) throw new Error("Failed to delete order on server");
                        await syncDatabase();
                        showToast(`Deleted order "${ord.orderNo}".`, "info");
                        await addLog(`User (${currentUser.name}) deleted order "${ord.orderNo}" (${id}).`, "warning");
                        renderOrdersTableRows(document.getElementById("orders-search-input").value.trim().toLowerCase());
                    } catch (err) {
                        showToast("Delete error: " + err.message, "error");
                    }
                }
            });
        });

        lucide.createIcons();
    }

    // Expose routing globally for navigation helpers
    window.app = {
        showPage: showPage
    };
})();

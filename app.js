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

    // Core application variables loaded from LocalStorage or Defaults
    let db = {
        users: JSON.parse(localStorage.getItem("mp_users")) || DEFAULT_USERS,
        tasks: JSON.parse(localStorage.getItem("mp_tasks")) || DEFAULT_TASKS,
        announcements: JSON.parse(localStorage.getItem("mp_announcements")) || DEFAULT_ANNOUNCEMENTS,
        logs: JSON.parse(localStorage.getItem("mp_logs")) || DEFAULT_LOGS,
        reports: JSON.parse(localStorage.getItem("mp_reports")) || DEFAULT_REPORTS
    };

    let currentUser = JSON.parse(sessionStorage.getItem("mp_active_user")) || null;
    let activePage = null;

    // Helper to persist changes
    function saveDatabase() {
        localStorage.setItem("mp_users", JSON.stringify(db.users));
        localStorage.setItem("mp_tasks", JSON.stringify(db.tasks));
        localStorage.setItem("mp_announcements", JSON.stringify(db.announcements));
        localStorage.setItem("mp_logs", JSON.stringify(db.logs));
        localStorage.setItem("mp_reports", JSON.stringify(db.reports));
    }

    // Logger Utility
    function addLog(message, type = "info") {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const log = { id: "l-" + Date.now() + Math.random().toString(36).substr(2, 4), time: timeStr, type: type, msg: message };
        db.logs.unshift(log); // Add to beginning
        saveDatabase();
        
        // If we are currently on logs page, re-render it
        if (currentUser && currentUser.role === "superadmin" && activePage === "superadmin-logs") {
            renderLogsPage();
        }
    }

    // ==========================================
    // 2. INITIALIZATION & ROUTING
    // ==========================================
    window.addEventListener("DOMContentLoaded", () => {
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
    function renderSuperAdminMetrics() {
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

    function handleCreateUser(e) {
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

        db.users.push(newUser);
        saveDatabase();
        
        showToast(`Staff account for ${name} created successfully.`, "success");
        addLog(`Super Admin created new user: ${name} (${role}).`, "success");

        // Clear and Refresh
        document.getElementById("create-user-form").reset();
        renderSuperAdminUserTable();
    }

    function toggleUserStatus(userId) {
        const user = db.users.find(u => u.id === userId);
        if (!user) return;

        const newStatus = user.status === "active" ? "suspended" : "active";
        user.status = newStatus;
        saveDatabase();

        showToast(`User ${user.name} is now ${newStatus}.`, "success");
        addLog(`Super Admin toggled user status for ${user.name} to ${newStatus}.`, "warning");

        renderSuperAdminUserTable();
    }

    function deleteUserAccount(userId) {
        const user = db.users.find(u => u.id === userId);
        if (!user) return;

        if (confirm(`Are you sure you want to delete the staff account for ${user.name}? This action is irreversible.`)) {
            db.users = db.users.filter(u => u.id !== userId);
            saveDatabase();

            showToast("Account deleted successfully.", "info");
            addLog(`Super Admin deleted account of ${user.name}.`, "danger");

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

    function handleClearLogs() {
        if (confirm("Are you sure you want to purge all system logs? This cannot be undone.")) {
            db.logs = [];
            saveDatabase();
            showToast("System logs cleared.", "info");
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

    function handleAssignTask(e) {
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

        db.tasks.push(newTask);
        saveDatabase();

        showToast(`Task assigned successfully to ${employee.name}.`, "success");
        addLog(`Admin (${currentUser.name}) dispatched task "${title}" to ${employee.name}.`, "info");

        document.getElementById("assign-task-form").reset();
        renderAdminTasksList();
    }

    function deleteTask(taskId) {
        const task = db.tasks.find(t => t.id === taskId);
        if (!task) return;

        if (confirm(`Delete the task order "${task.title}"?`)) {
            db.tasks = db.tasks.filter(t => t.id !== taskId);
            saveDatabase();

            showToast("Task deleted successfully.", "info");
            addLog(`Admin (${currentUser.name}) deleted task order "${task.title}".`, "warning");

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

    function handlePostAnnouncement(e) {
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

        db.announcements.push(newAnnouncement);
        saveDatabase();

        showToast("Company announcement posted successfully.", "success");
        addLog(`Admin (${currentUser.name}) posted new announcement: "${title}".`, "info");

        document.getElementById("post-announcement-form").reset();
        renderAdminDetailedAnnouncements();
    }

    function deleteAnnouncement(annId) {
        const item = db.announcements.find(a => a.id === annId);
        if (!item) return;

        if (confirm(`Remove the announcement: "${item.title}"?`)) {
            db.announcements = db.announcements.filter(a => a.id !== annId);
            saveDatabase();

            showToast("Announcement removed.", "info");
            addLog(`Admin (${currentUser.name}) deleted announcement: "${item.title}".`, "warning");

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

    function updateTaskStatus(taskId, action) {
        const task = db.tasks.find(t => t.id === taskId);
        if (!task) return;

        task.status = action;
        saveDatabase();

        const actionText = action === "progress" ? "marked as In Progress" : "completed";
        showToast(`Task was successfully ${actionText}.`, "success");
        addLog(`Employee (${currentUser.name}) updated task status of "${task.title}" to ${action}.`, "info");

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

    function handleSubmitReport(e) {
        e.preventDefault();

        const reportText = document.getElementById("report-text").value.trim();
        const date = new Date().toISOString().split('T')[0];

        const newReport = {
            id: "r-" + Date.now(),
            userId: currentUser.id,
            date: date,
            text: reportText
        };

        db.reports.push(newReport);
        saveDatabase();

        showToast("Daily status report logged successfully.", "success");
        addLog(`Employee (${currentUser.name}) logged daily status report.`, "info");

        document.getElementById("report-text").value = "";
        renderEmployeeReportsTable();
    }

    // Expose routing globally for navigation helpers
    window.app = {
        showPage: showPage
    };
})();

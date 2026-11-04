/* =========================================
   AI Study Assistant V1.3
   Navigation Controller
========================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =====================================
       1. DOM Elements
    ===================================== */

    const navItems = document.querySelectorAll(
        ".nav-item[data-page]"
    );

    const pages = document.querySelectorAll(".page");

    const openButtons = document.querySelectorAll("[data-open]");

    const goButtons = document.querySelectorAll("[data-go]");

    const sidebar = document.querySelector(".sidebar");

    const sidebarOverlay = document.querySelector(
        ".sidebar-overlay, [data-sidebar-overlay]"
    );

    const sidebarToggleButtons = document.querySelectorAll(
        "[data-sidebar-toggle], .mobile-menu-toggle"
    );

    const sidebarCloseButtons = document.querySelectorAll(
        "[data-sidebar-close]"
    );

    const pageTitle = document.querySelector(
        "#current-page-title, [data-current-page-title]"
    );

    /* =====================================
       2. Page Title
    ===================================== */

    function updatePageTitle(pageName) {

        if (!pageTitle) return;

        // 优先使用导航按钮上设置的标题
        const navItem = document.querySelector(
            `.nav-item[data-page="${pageName}"]`
        );

        const title =
            navItem?.dataset.title ||
            navItem?.textContent?.trim() ||
            pageName;

        pageTitle.textContent = title;
    }

    /* =====================================
       3. Sidebar
    ===================================== */

    function openSidebar() {

        if (!sidebar) return;

        sidebar.classList.add("open");
        sidebar.classList.add("active");

        if (sidebarOverlay) {
            sidebarOverlay.classList.add("active");
        }

        sidebarToggleButtons.forEach(button => {
            button.setAttribute("aria-expanded", "true");
        });

        document.body.classList.add("sidebar-open");
    }

    function closeSidebar() {

        if (!sidebar) return;

        sidebar.classList.remove("open");
        sidebar.classList.remove("active");

        if (sidebarOverlay) {
            sidebarOverlay.classList.remove("active");
        }

        sidebarToggleButtons.forEach(button => {
            button.setAttribute("aria-expanded", "false");
        });

        document.body.classList.remove("sidebar-open");
    }

    /* =====================================
       4. Panel Control
    ===================================== */

    function setPanelState(panelId, isOpen) {

        if (!panelId) return;

        const panel = document.getElementById(panelId);

        if (!panel) {
            console.warn(`面板不存在：${panelId}`);
            return;
        }

        panel.classList.toggle("hidden", !isOpen);
        panel.classList.toggle("active", isOpen);

        // 同步所有指向该面板的按钮状态
        document.querySelectorAll("[data-open]").forEach(button => {

            if (button.dataset.open === panelId) {
                button.setAttribute(
                    "aria-expanded",
                    String(isOpen)
                );
            }
        });

        if (isOpen) {
            panel.scrollIntoView({
                behavior: "smooth",
                block: "nearest"
            });
        }
    }

    function togglePanel(panelId, triggerButton) {

        if (!panelId) return;

        const panel = document.getElementById(panelId);

        if (!panel) {
            console.warn(`面板不存在：${panelId}`);
            return;
        }

        const willOpen = panel.classList.contains("hidden");

        setPanelState(panelId, willOpen);

        if (triggerButton) {
            triggerButton.setAttribute(
                "aria-expanded",
                String(willOpen)
            );
        }
    }

    function closeAllPanels() {

        document.querySelectorAll("[data-open]").forEach(button => {

            const panelId = button.dataset.open;

            const panel = document.getElementById(panelId);

            if (!panel) return;

            panel.classList.add("hidden");
            panel.classList.remove("active");

            button.setAttribute("aria-expanded", "false");
        });
    }

    /* =====================================
       5. Page Navigation
    ===================================== */

    function showPage(pageName) {

        if (!pageName) return false;

        const targetPage = document.getElementById(
            `${pageName}-page`
        );

        if (!targetPage) {
            console.warn(`页面不存在：${pageName}-page`);
            return false;
        }

        // 隐藏其他页面
        pages.forEach(page => {

            page.classList.remove("active");

            page.setAttribute("aria-hidden", "true");
        });

        // 显示目标页面
        targetPage.classList.add("active");

        targetPage.setAttribute("aria-hidden", "false");

        // 更新侧边栏导航状态
        navItems.forEach(item => {

            const isActive = item.dataset.page === pageName;

            item.classList.toggle("active", isActive);

            if (isActive) {
                item.setAttribute("aria-current", "page");
            } else {
                item.removeAttribute("aria-current");
            }
        });

        // 更新顶部页面标题
        updatePageTitle(pageName);

        // 关闭移动端侧边栏
        closeSidebar();

        // 页面切换后回到顶部
        const mainContent = document.querySelector(".main-content");

        if (mainContent) {
            mainContent.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        }

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

        // 通知其他功能页面已经切换
        document.dispatchEvent(
            new CustomEvent("app:pagechange", {
                detail: {
                    page: pageName
                }
            })
        );

        return true;
    }

    /* =====================================
       6. Sidebar Navigation
    ===================================== */

    navItems.forEach(item => {

        item.addEventListener("click", event => {

            event.preventDefault();

            showPage(item.dataset.page);
        });
    });

    /* =====================================
       7. Dashboard Quick Navigation
       支持 data-go + data-open
    ===================================== */

    goButtons.forEach(button => {

        button.addEventListener("click", event => {

            event.preventDefault();

            const pageName = button.dataset.go;
            const panelId = button.dataset.open;

            // 第一步：切换页面
            const success = showPage(pageName);

            // 第二步：页面切换成功后打开指定面板
            if (success && panelId) {

                setPanelState(panelId, true);
            }
        });
    });

    /* =====================================
       8. Panel Toggle Buttons
    ===================================== */

    openButtons.forEach(button => {

        // 带 data-go 的按钮已经在上面统一处理
        if (button.hasAttribute("data-go")) return;

        button.addEventListener("click", event => {

            event.preventDefault();

            togglePanel(
                button.dataset.open,
                button
            );
        });
    });

    /* =====================================
       9. Mobile Sidebar Controls
    ===================================== */

    sidebarToggleButtons.forEach(button => {

        button.addEventListener("click", event => {

            event.preventDefault();

            if (
                sidebar &&
                (
                    sidebar.classList.contains("open") ||
                    sidebar.classList.contains("active")
                )
            ) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });
    });

    sidebarCloseButtons.forEach(button => {

        button.addEventListener("click", event => {

            event.preventDefault();

            closeSidebar();
        });
    });

    if (sidebarOverlay) {

        sidebarOverlay.addEventListener("click", closeSidebar);
    }

    /* =====================================
       10. Keyboard Shortcuts
    ===================================== */

    document.addEventListener("keydown", event => {

        if (event.key === "Escape") {

            // 关闭移动端侧边栏
            closeSidebar();

            // 关闭所有打开的面板
            closeAllPanels();
        }
    });

    /* =====================================
       11. Navigation Initialization
    ===================================== */

    function initializeNavigation() {

        // 初始化所有页面
        pages.forEach(page => {

            page.classList.remove("active");

            page.setAttribute("aria-hidden", "true");
        });

        // 默认显示首页
        showPage("home");
    }

    initializeNavigation();

    /* =====================================
       12. Expose Navigation API
    ===================================== */

    window.AppNavigation = {
        showPage,
        openSidebar,
        closeSidebar,
        togglePanel,
        closeAllPanels
    };

});
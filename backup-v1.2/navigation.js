
/* =========================================
   AI Study Assistant V1.2
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

    /* =====================================
       2. Page Navigation
    ===================================== */

    function showPage(pageName) {

        if (!pageName) return;

        const targetPage = document.getElementById(
            `${pageName}-page`
        );

        if (!targetPage) {
            console.warn(`页面不存在：${pageName}-page`);
            return;
        }

        // 隐藏其他页面
        pages.forEach(page => {
            page.classList.remove("active");

            page.setAttribute("aria-hidden", "true");
        });

        // 显示目标页面
        targetPage.classList.add("active");

        targetPage.setAttribute("aria-hidden", "false");

        // 更新导航状态
        navItems.forEach(item => {

            const isActive = item.dataset.page === pageName;

            item.classList.toggle("active", isActive);

            if (isActive) {
                item.setAttribute("aria-current", "page");
            } else {
                item.removeAttribute("aria-current");
            }
        });

        // 页面切换后关闭移动端侧边栏
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
    }

    /* =====================================
       3. Sidebar Navigation
    ===================================== */

    navItems.forEach(item => {

        item.addEventListener("click", event => {

            event.preventDefault();

            showPage(item.dataset.page);
        });
    });

    /* =====================================
       4. Dashboard Quick Navigation
    ===================================== */

    goButtons.forEach(button => {

        button.addEventListener("click", event => {

            event.preventDefault();

            showPage(button.dataset.go);
        });
    });

    /* =====================================
       5. Panel Toggle
    ===================================== */

    function togglePanel(panelId, triggerButton) {

        if (!panelId) return;

        const panel = document.getElementById(panelId);

        if (!panel) {
            console.warn(`面板不存在：${panelId}`);
            return;
        }

        const willOpen = panel.classList.contains("hidden");

        panel.classList.toggle("hidden", !willOpen);

        panel.classList.toggle("active", willOpen);

        if (triggerButton) {

            triggerButton.setAttribute(
                "aria-expanded",
                String(willOpen)
            );
        }

        if (willOpen) {
            panel.scrollIntoView({
                behavior: "smooth",
                block: "nearest"
            });
        }
    }

    openButtons.forEach(button => {

        button.addEventListener("click", event => {

            event.preventDefault();

            togglePanel(
                button.dataset.open,
                button
            );
        });
    });

    /* =====================================
       6. Mobile Sidebar
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
       7. Keyboard Shortcuts
    ===================================== */

    document.addEventListener("keydown", event => {

        if (event.key === "Escape") {

            // 关闭移动端侧边栏
            closeSidebar();

            // 关闭当前打开的面板
            document.querySelectorAll(
                "[data-open]"
            ).forEach(button => {

                const panel = document.getElementById(
                    button.dataset.open
                );

                if (!panel) return;

                if (!panel.classList.contains("hidden")) {

                    panel.classList.add("hidden");

                    panel.classList.remove("active");

                    button.setAttribute(
                        "aria-expanded",
                        "false"
                    );
                }
            });
        }
    });

    /* =====================================
       8. Navigation Initialization
    ===================================== */

    function initializeNavigation() {

        // 先清除页面状态
        pages.forEach(page => {
            page.classList.remove("active");
            page.setAttribute("aria-hidden", "true");
        });

        // 默认显示首页
        showPage("home");
    }

    initializeNavigation();

    /* =====================================
       9. Expose Navigation API
       供其他前端功能调用
    ===================================== */

    window.AppNavigation = {
        showPage,
        openSidebar,
        closeSidebar,
        togglePanel
    };

});

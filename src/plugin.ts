/// <reference path="./plugin.d.ts" />
/// <reference path="./app.d.ts" />

function init() {
    $ui.register((ctx) => {
        // ─── State ───
        const currentMediaId = ctx.state<number | null>(null)
        const watchOrderData = ctx.state<any>(null)
        const isLoading = ctx.state(false)
        const errorMessage = ctx.state<string | null>(null)
        const selectedOrder = ctx.state(0)

        // ─── Action Button on anime pages ───
        const roadmapButton = ctx.action.newAnimePageButton({
            label: "🗺️ Watch Roadmap",
            intent: "primary-subtle",
        })

        roadmapButton.onClick((event) => {
            const media = event.media
            if (media && media.id) {
                currentMediaId.set(media.id)
                tray.open()
            }
        })

        // ─── Tray Icon (Drawer mode for full roadmap) ───
        const tray = ctx.newTray({
            tooltipText: "Anime Watch Roadmap",
            iconUrl: "https://api.iconify.design/material-symbols:map-outline-rounded.svg?color=%236366f1",
            withContent: true,
            isDrawer: true,
        })

        // ─── Track navigation to anime pages ───
        ctx.screen.onNavigate((e) => {
            if (e.pathname === "/entry" && !!e.searchParams.id) {
                const id = parseInt(e.searchParams.id)
                currentMediaId.set(id)
                roadmapButton.mount()
            } else {
                currentMediaId.set(null)
                roadmapButton.unmount()
            }
        })

        ctx.screen.loadCurrent()

        tray.onOpen(() => {
            ctx.screen.loadCurrent()
        })

        // ─── Fetch Watch Order Data ───
        async function fetchWatchOrder(mediaId: number) {
            isLoading.set(true)
            errorMessage.set(null)
            watchOrderData.set(null)
            selectedOrder.set(0)

            try {
                const res = await ctx.fetch(
                    "https://raw.githubusercontent.com/Bas1874/Anime-Watch-Order-Api/refs/heads/main/data/watch_order_api.json"
                )
                const apiData = res.json()

                if (!apiData || !apiData.data) {
                    errorMessage.set("Failed to load watch order data.")
                    isLoading.set(false)
                    return
                }

                // Search for the anime in the watch order data by AniList ID
                let foundEntry: any = null
                for (const entry of apiData.data) {
                    if (foundEntry) break
                    for (const order of entry.watch_orders) {
                        if (foundEntry) break
                        for (const step of order.steps) {
                            if (step.media && step.media.id === mediaId) {
                                foundEntry = entry
                                break
                            }
                        }
                    }
                }

                if (foundEntry) {
                    watchOrderData.set(foundEntry)
                    tray.updateBadge({ number: foundEntry.watch_orders[0].steps.length, intent: "info" })
                } else {
                    errorMessage.set("No watch order found for this anime. This series may not be part of a larger franchise.")
                    tray.updateBadge({ number: 0 })
                }
            } catch (e) {
                errorMessage.set("Error fetching watch order data. Check your internet connection.")
                console.error(e)
            }

            isLoading.set(false)
        }

        // ─── Effect: Fetch when media changes ───
        ctx.effect(() => {
            const id = currentMediaId.get()
            if (id) {
                fetchWatchOrder(id)
            } else {
                watchOrderData.set(null)
                errorMessage.set(null)
                tray.updateBadge({ number: 0 })
            }
        }, [currentMediaId])

        // ─── Render Tray Content (Roadmap UI) ───
        tray.render(() => {
            const id = currentMediaId.get()
            const data = watchOrderData.get()
            const loading = isLoading.get()
            const error = errorMessage.get()
            const orderIdx = selectedOrder.get()

            // ── No anime selected ──
            if (!id) {
                return tray.stack([
                    tray.div([
                        tray.text("🗺️ Anime Watch Roadmap", {
                            style: { fontSize: "1.1rem", fontWeight: "700", marginBottom: "8px" }
                        }),
                        tray.text("Navigate to an anime page to see its watch order roadmap.", {
                            style: { opacity: "0.6", fontSize: "0.875rem" }
                        }),
                    ], { style: { padding: "16px" } }),
                ])
            }

            // ── Loading state ──
            if (loading) {
                return tray.stack([
                    tray.div([
                        tray.text("⏳ Loading roadmap...", {
                            style: { fontSize: "0.95rem", opacity: "0.7", textAlign: "center", padding: "32px 16px" }
                        }),
                    ]),
                ])
            }

            // ── Error state ──
            if (error) {
                return tray.stack([
                    tray.div([
                        tray.text("🗺️ Anime Watch Roadmap", {
                            style: { fontSize: "1.1rem", fontWeight: "700", marginBottom: "12px" }
                        }),
                        tray.alert(error, { intent: "warning" }),
                    ], { style: { padding: "16px" } }),
                ])
            }

            // ── No data ──
            if (!data) {
                return tray.stack([
                    tray.text("No data available.", { style: { padding: "16px", opacity: "0.5" } }),
                ])
            }

            // ────────────────────────────────────
            // Build the Roadmap
            // ────────────────────────────────────

            const orders = data.watch_orders || []
            const currentOrder = orders[orderIdx] || orders[0]
            const allItems: any[] = []

            // ── Header ──
            allItems.push(
                tray.div([
                    tray.text("🗺️ " + data.title, {
                        style: { fontSize: "1.15rem", fontWeight: "800", marginBottom: "4px" }
                    }),
                    data.prologue
                        ? tray.text(data.prologue.substring(0, 200) + (data.prologue.length > 200 ? "..." : ""), {
                            style: { fontSize: "0.8rem", opacity: "0.5", marginBottom: "12px", lineHeight: "1.4" }
                        })
                        : tray.text(""),
                ], { style: { padding: "0 0 8px 0" } })
            )

            // ── Order selector tabs (if multiple orders exist) ──
            if (orders.length > 1) {
                const tabButtons = []
                for (let i = 0; i < orders.length; i++) {
                    const order = orders[i]
                    tabButtons.push(
                        tray.button({
                            label: order.name || "Order " + (i + 1),
                            onClick: ctx.eventHandler("select-order-" + i, () => {
                                selectedOrder.set(i)
                            }),
                            intent: i === orderIdx ? "primary" : "gray-subtle",
                            size: "sm",
                        })
                    )
                }
                allItems.push(
                    tray.div(tabButtons, {
                        style: {
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "6px",
                            marginBottom: "16px",
                        }
                    })
                )
            }

            // ── Order description ──
            if (currentOrder && currentOrder.description) {
                allItems.push(
                    tray.div([
                        tray.text(currentOrder.description.substring(0, 300) + (currentOrder.description.length > 300 ? "..." : ""), {
                            style: { fontSize: "0.8rem", opacity: "0.55", lineHeight: "1.5", marginBottom: "12px" }
                        }),
                    ])
                )
            }

            // ── Roadmap step nodes ──
            const steps = currentOrder ? currentOrder.steps || [] : []
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i]
                const media = step.media
                const isCurrentAnime = media && media.id === id
                const isOptional = step.is_optional
                const title = (media && media.title) 
                    ? (media.title.english || media.title.romaji || step.step_title)
                    : (step.step_title || "Unknown")
                const format = media ? (media.format || "") : ""
                const episodes = media ? (media.episodes || "") : ""
                const score = media ? (media.averageScore || "") : ""

                const borderColor = isCurrentAnime ? "#6366f1" : (isOptional ? "#7c3aed" : "#1e293b")
                const bgColor = isCurrentAnime ? "#1e1b4b" : "#0f172a"

                // Build info badges
                const badgeItems: any[] = []
                if (format) {
                    badgeItems.push(tray.badge(format, { intent: "gray" }))
                }
                if (episodes) {
                    badgeItems.push(tray.text(episodes + " ep", { style: { fontSize: "0.75rem", opacity: "0.6" } }))
                }
                if (score) {
                    badgeItems.push(tray.text("⭐ " + score + "%", { style: { fontSize: "0.75rem", opacity: "0.6" } }))
                }
                if (isOptional) {
                    badgeItems.push(tray.badge("Optional", { intent: "warning" }))
                }
                if (isCurrentAnime) {
                    badgeItems.push(tray.badge("● You are here", { intent: "info" }))
                }

                // Step node
                const nodeContent = tray.div([
                    tray.flex([
                        // Step number circle
                        tray.div([
                            tray.text(String(i + 1), {
                                style: {
                                    fontSize: "0.75rem",
                                    fontWeight: "700",
                                    color: isCurrentAnime ? "#a5b4fc" : "#94a3b8",
                                }
                            }),
                        ], {
                            style: {
                                width: "28px",
                                height: "28px",
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: isCurrentAnime ? "#312e81" : "#1e293b",
                                flexShrink: "0",
                            }
                        }),
                        // Title and badges
                        tray.div([
                            tray.text(title, {
                                style: {
                                    fontWeight: "600",
                                    fontSize: "0.875rem",
                                    color: isCurrentAnime ? "#c7d2fe" : "#e2e8f0",
                                }
                            }),
                            tray.flex(badgeItems, {
                                gap: 1,
                                style: { flexWrap: "wrap", marginTop: "4px" }
                            }),
                        ], { style: { flex: "1", minWidth: "0" } }),
                    ], { gap: 2, style: { alignItems: "flex-start" } }),
                ], {
                    style: {
                        padding: "12px",
                        borderRadius: "10px",
                        border: "2px solid " + borderColor,
                        background: bgColor,
                        cursor: (media && !isCurrentAnime) ? "pointer" : "default",
                        transition: "all 0.2s ease",
                    }
                })

                // Wrap in clickable link if navigable
                if (media && media.id && !isCurrentAnime) {
                    allItems.push(
                        tray.div([
                            tray.a([nodeContent], {
                                href: "#",
                                style: { textDecoration: "none", color: "inherit", display: "block" },
                                onClick: ctx.eventHandler("nav-" + media.id, () => {
                                    ctx.screen.navigateTo("/entry", { id: String(media.id) })
                                    tray.close()
                                }),
                            }),
                        ])
                    )
                } else {
                    allItems.push(tray.div([nodeContent]))
                }

                // Connector line (except for last step)
                if (i < steps.length - 1) {
                    allItems.push(
                        tray.div([
                            tray.div([], {
                                style: {
                                    width: "2px",
                                    height: "16px",
                                    margin: "0 auto",
                                    background: "linear-gradient(to bottom, #6366f1, rgba(99,102,241,0.3))",
                                }
                            }),
                            tray.text("▼", {
                                style: {
                                    textAlign: "center",
                                    fontSize: "0.55rem",
                                    color: "#6366f1",
                                    lineHeight: "1",
                                    display: "block",
                                }
                            }),
                        ], { style: { textAlign: "center", padding: "2px 0" } })
                    )
                }
            }

            // ── Entry notes ──
            if (data.entry_notes) {
                allItems.push(
                    tray.div([
                        tray.alert(data.entry_notes, { intent: "info" }),
                    ], { style: { marginTop: "12px" } })
                )
            }

            return tray.stack(allItems, { style: { padding: "16px", gap: "4px" } })
        })
    })
}

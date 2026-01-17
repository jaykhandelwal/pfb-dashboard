
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Truck, Plus, Trash2, Edit2, Snowflake, X, Box, Calculator, Cuboid, Settings, BarChart2, Calendar, ArrowRight, ClipboardCopy, CheckCircle2, AlertCircle, IndianRupee, Info, TrendingUp, TrendingDown, Star, Loader2, Minus, RefreshCcw, AlertTriangle } from 'lucide-react';
import { StorageUnit, TransactionType, SKUCategory, SKU } from '../types';
import { getLocalISOString } from '../constants';

const StockOrdering: React.FC = () => {
    const { storageUnits, addStorageUnit, updateStorageUnit, deleteStorageUnit, appSettings, updateAppSetting, skus, transactions, orders, menuItems } = useStore();

    // Local State for Calculation - initialized from AppSettings or default 2.3
    const [litresPerPacket, setLitresPerPacket] = useState<string>(
        appSettings.stock_ordering_litres_per_packet?.toString() || '2.3'
    );

    // Sync state if appSettings updates externally (e.g. initial load)
    useEffect(() => {
        if (appSettings.stock_ordering_litres_per_packet && appSettings.stock_ordering_litres_per_packet.toString() !== litresPerPacket) {
            setLitresPerPacket(appSettings.stock_ordering_litres_per_packet.toString());
        }
    }, [appSettings.stock_ordering_litres_per_packet]);

    // Save to AppSettings on change
    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        setLitresPerPacket(newVal);
    };

    const saveVolumeSetting = () => {
        if (litresPerPacket) {
            updateAppSetting('stock_ordering_litres_per_packet', litresPerPacket);
        }
    };

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState<Partial<StorageUnit>>({});

    // Generator State
    const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
    const [arrivalDate, setArrivalDate] = useState<string>('');
    const [generatedOrder, setGeneratedOrder] = useState<any[]>([]);
    const [copySuccess, setCopySuccess] = useState(false);
    const [hasGenerated, setHasGenerated] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleAddNew = () => {
        setEditingUnit({ name: '', capacityLitres: 0, type: 'DEEP_FREEZER' });
        setIsModalOpen(true);
    };

    const handleEdit = (unit: StorageUnit) => {
        setEditingUnit({ ...unit });
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (window.confirm("Are you sure you want to remove this freezer?")) {
            deleteStorageUnit(id);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUnit.name || !editingUnit.capacityLitres) return;

        if (editingUnit.id) {
            await updateStorageUnit(editingUnit as StorageUnit);
        } else {
            await addStorageUnit(editingUnit as Omit<StorageUnit, 'id'>);
        }
        setIsModalOpen(false);
        setEditingUnit({});
    };

    // --- Volume Logic Helper (SIMPLIFIED) ---
    // Returns estimated Litres for a single packet of a specific SKU
    const getVolumePerPacket = (sku: SKU): number => {
        // 1. Chutney / Consumables Exception
        // Assumes Chutney/Sauce packets are ~1 Litre
        if (sku.category === SKUCategory.CONSUMABLES) {
            return 1.0;
        }

        // 2. Global Average for Everything Else
        // Default: 2.3L per bag
        return parseFloat(litresPerPacket) || 2.3;
    };

    // --- Calculations ---

    // 1. Total Litres Capacity
    const totalCapacityLitres = useMemo(() => {
        return storageUnits.reduce((acc, unit) => acc + (unit.isActive ? unit.capacityLitres : 0), 0);
    }, [storageUnits]);

    // 2. Current Stock & Consumption Logic
    const { currentStockLitres, recommendedOrders, availableLitres, stockMapPackets } = useMemo(() => {
        // A. Calculate Current Stock (Only for Enabled SKUs)
        const relevantSkus = skus.filter(s => s.isDeepFreezerItem);

        const skuSizeMap: Record<string, number> = {};
        relevantSkus.forEach(s => skuSizeMap[s.id] = (s.piecesPerPacket > 0 ? s.piecesPerPacket : 1));

        const sMapPkts: Record<string, number> = {}; // SKU ID -> Packet Count

        // Calculate Stock Levels locally (Pieces)
        const levels: Record<string, number> = {};
        relevantSkus.forEach(s => levels[s.id] = 0);

        transactions.forEach(t => {
            if (levels[t.skuId] === undefined) return;
            if (t.type === TransactionType.RESTOCK || t.type === TransactionType.CHECK_IN || (t.type === TransactionType.ADJUSTMENT && t.quantityPieces > 0)) {
                levels[t.skuId] += t.quantityPieces;
            } else if (t.type === TransactionType.CHECK_OUT || (t.type === TransactionType.ADJUSTMENT && t.quantityPieces < 0) || (t.type === TransactionType.WASTE && t.branchId === 'FRIDGE')) {
                levels[t.skuId] -= Math.abs(t.quantityPieces);
            }
        });

        let usedLitres = 0;
        Object.keys(levels).forEach(skuId => {
            const sku = relevantSkus.find(s => s.id === skuId);
            if (!sku) return;

            const pktSize = skuSizeMap[skuId] || 1;
            const pkts = Math.max(0, levels[skuId]) / pktSize; // Fractional packets count towards volume

            sMapPkts[skuId] = pkts;

            // VOLUME CALCULATION
            const volPerPkt = getVolumePerPacket(sku);
            usedLitres += (pkts * volPerPkt);
        });

        const availableL = Math.max(0, totalCapacityLitres - usedLitres);

        // B. Calculate 90-Day Consumption (In LITRES)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 90);
        const cutoffStr = cutoffDate.toISOString().slice(0, 10);

        const consumptionLitresMap: Record<string, number> = {};
        let totalLitresConsumed = 0;

        transactions.forEach(t => {
            if (t.date >= cutoffStr && sMapPkts[t.skuId] !== undefined) {
                const sku = relevantSkus.find(s => s.id === t.skuId);
                if (!sku) return;

                const pktSize = skuSizeMap[t.skuId] || 1;
                const packets = t.quantityPieces / pktSize;
                const volPerPkt = getVolumePerPacket(sku);
                const litres = packets * volPerPkt;

                if (t.type === TransactionType.CHECK_OUT || (t.type === TransactionType.WASTE && t.branchId === 'FRIDGE')) {
                    consumptionLitresMap[t.skuId] = (consumptionLitresMap[t.skuId] || 0) + litres;
                    totalLitresConsumed += litres;
                } else if (t.type === TransactionType.CHECK_IN) {
                    consumptionLitresMap[t.skuId] = (consumptionLitresMap[t.skuId] || 0) - litres;
                    totalLitresConsumed -= litres;
                }
            }
        });

        totalLitresConsumed = Math.max(0, totalLitresConsumed);

        // C. Generate Recommendations (Fill based on Volume Share)
        const recommendations: { sku: any, currentPkts: number, consumptionShare: number, recommendPkts: number }[] = [];

        relevantSkus.forEach(sku => {
            const consumedL = Math.max(0, consumptionLitresMap[sku.id] || 0);
            let share = 0;
            let recommendedPkts = 0;

            if (totalLitresConsumed > 0) {
                share = consumedL / totalLitresConsumed; // % of total VOLUME consumed

                if (availableL > 0) {
                    // Litres to add for this SKU
                    const litresToAdd = availableL * share;
                    // Convert Litres back to Packets (FLOOR to be safe)
                    const volPerPkt = getVolumePerPacket(sku);
                    recommendedPkts = Math.floor(litresToAdd / volPerPkt);
                }
            }

            recommendations.push({
                sku,
                currentPkts: sMapPkts[sku.id] || 0,
                consumptionShare: share,
                recommendPkts: recommendedPkts
            });
        });

        return {
            currentStockLitres: Math.ceil(usedLitres),
            availableLitres: Math.floor(availableL),
            recommendedOrders: recommendations.sort((a, b) => b.recommendPkts - a.recommendPkts),
            stockMapPackets: sMapPkts
        };

    }, [skus, transactions, totalCapacityLitres, litresPerPacket]);

    // --- Display Conversion Helper ---
    const displayStandardVol = parseFloat(litresPerPacket) || 2.3;
    const totalCapacityPackets = Math.floor(totalCapacityLitres / displayStandardVol);
    const usedCapacityPackets = Math.ceil(currentStockLitres / displayStandardVol);
    const freeCapacityPackets = Math.floor(availableLitres / displayStandardVol);

    // --- SMART GENERATOR LOGIC (Multi-Factor) ---
    const runGenerator = () => {
        try {
            setHasGenerated(false);
            if (!arrivalDate) {
                alert("Please select an expected arrival date.");
                setIsGenerating(false);
                return;
            }

            if (totalCapacityLitres <= 0) {
                alert("Total Capacity is 0. Please add Deep Freezers in the configuration section below.");
                return;
            }

            const relevantSkus = skus.filter(s => s.isDeepFreezerItem);
            if (relevantSkus.length === 0) {
                alert("No SKUs are marked for 'Deep Freezer' storage. Go to SKU Management and check 'Store in Deep Freezer' for items you want to order.");
                return;
            }

            // 1. Lead Time Calculation
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Parse date explicitly to avoid UTC shift
            const [y, m, d] = arrivalDate.split('-').map(Number);
            const arrival = new Date(y, m - 1, d);
            arrival.setHours(0, 0, 0, 0);

            const diffTime = arrival.getTime() - today.getTime();
            const daysUntilArrival = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (daysUntilArrival < 0) {
                alert("Arrival date cannot be in the past.");
                setIsGenerating(false);
                return;
            }

            // 2. Calculate Order Popularity (Frequency) - Last 30 Days
            // This answers "How many orders included this item?"
            const d30 = new Date();
            d30.setDate(d30.getDate() - 30);
            const d30Str = d30.toISOString().slice(0, 10);

            const orderFrequencyMap: Record<string, number> = {};
            const relevantOrders = orders.filter(o => o.date >= d30Str);

            relevantOrders.forEach(o => {
                const skusInOrder = new Set<string>();
                // Safeguard: o.items might be missing if data corrupted
                if (o.items && Array.isArray(o.items)) {
                    o.items.forEach(item => {
                        // Extract SKUs from consumed list or menu lookup
                        if (item.consumed && Array.isArray(item.consumed)) {
                            item.consumed.forEach(c => skusInOrder.add(c.skuId));
                        } else {
                            const menuItem = menuItems.find(m => m.id === item.menuItemId);
                            if (menuItem) {
                                const ings = item.variant === 'HALF' ? menuItem.halfIngredients : menuItem.ingredients;
                                // Safeguard: ingredients might be undefined
                                if (ings && Array.isArray(ings)) {
                                    ings.forEach(i => skusInOrder.add(i.skuId));
                                } else if (menuItem.ingredients && Array.isArray(menuItem.ingredients)) {
                                    // Fallback to full ingredients if variant invalid
                                    menuItem.ingredients.forEach(i => skusInOrder.add(i.skuId));
                                }
                            }
                        }
                    });
                }
                // Also check custom items
                o.customSkuItems?.forEach(ci => skusInOrder.add(ci.skuId));

                skusInOrder.forEach(skuId => {
                    orderFrequencyMap[skuId] = (orderFrequencyMap[skuId] || 0) + 1;
                });
            });

            // Determine Top 20% popular items for "Star" badge
            const frequencies = Object.values(orderFrequencyMap).sort((a, b) => b - a);
            const topTierThreshold = frequencies.length > 0 ? frequencies[Math.floor(frequencies.length * 0.2)] : 0;

            // 3. Short Term Velocity (7-Day Burn Rate)
            const d7 = new Date();
            d7.setDate(d7.getDate() - 7);
            const d7Str = d7.toISOString().slice(0, 10);

            const velocityLitresMap: Record<string, number> = {};

            // 4. Long Term Trends (90-Day Distribution)
            const d90 = new Date();
            d90.setDate(d90.getDate() - 90);
            const d90Str = d90.toISOString().slice(0, 10);

            const distributionLitresMap: Record<string, number> = {};

            const skuSizeMap: Record<string, number> = {};

            // Initialize Maps
            relevantSkus.forEach(s => {
                skuSizeMap[s.id] = (s.piecesPerPacket > 0 ? s.piecesPerPacket : 1);
                velocityLitresMap[s.id] = 0;
                distributionLitresMap[s.id] = 0;
            });

            // Populate Volume Data
            transactions.forEach(t => {
                if (!skuSizeMap[t.skuId] || (t.type !== TransactionType.CHECK_OUT && t.type !== TransactionType.WASTE && t.type !== TransactionType.CHECK_IN)) return;

                const sku = relevantSkus.find(s => s.id === t.skuId);
                if (!sku) return;

                const pktSize = skuSizeMap[t.skuId];
                const packets = t.quantityPieces / pktSize;
                const volPerPkt = getVolumePerPacket(sku);
                const litres = packets * volPerPkt;

                const isConsumption = (t.type === TransactionType.CHECK_OUT || (t.type === TransactionType.WASTE && t.branchId === 'FRIDGE'));
                const isReturn = (t.type === TransactionType.CHECK_IN);

                // 7-Day Logic
                if (t.date >= d7Str) {
                    if (isConsumption) velocityLitresMap[t.skuId] += litres;
                    else if (isReturn) velocityLitresMap[t.skuId] -= litres;
                }

                // 90-Day Logic
                if (t.date >= d90Str) {
                    if (isConsumption) distributionLitresMap[t.skuId] += litres;
                    else if (isReturn) distributionLitresMap[t.skuId] -= litres;
                }
            });

            // 5. True Physical Availability Calculation
            const projectedStocks: Record<string, number> = {};
            let totalProjectedOccupiedLitres = 0;

            // First pass: Calculate projected stock at arrival date for ALL items using 7-day velocity
            relevantSkus.forEach(sku => {
                const volPerPkt = getVolumePerPacket(sku);
                const weeklyLitres = Math.max(0, velocityLitresMap[sku.id] || 0);
                const dailyAvgLitres = weeklyLitres / 7;

                const currentPkts = stockMapPackets[sku.id] || 0;
                const currentLitres = currentPkts * volPerPkt;
                const projectedBurnLitres = dailyAvgLitres * daysUntilArrival;

                const projStock = Math.max(0, currentLitres - projectedBurnLitres);
                projectedStocks[sku.id] = projStock;

                totalProjectedOccupiedLitres += projStock;
            });

            // 6. Calculate True Free Space
            let trueFreeLitres = Math.max(0, totalCapacityLitres - totalProjectedOccupiedLitres);

            const generated: any[] = [];

            // Calculate Total Weighted Demand for Normalization
            let totalWeightedDemand = 0;
            const skuWeightedDemandMap: Record<string, number> = {};

            // IMPROVEMENT: Minimum Safety Days constant (ensures X days of stock at current burn rate)
            const SAFETY_DAYS = 3;

            relevantSkus.forEach(sku => {
                const dailyVol90 = Math.max(0, distributionLitresMap[sku.id] || 0) / 90;
                const dailyVol7 = Math.max(0, velocityLitresMap[sku.id] || 0) / 7;

                // Check OOS status EARLY - this affects how we interpret the data
                const currentPkts = stockMapPackets[sku.id] || 0;
                const isOOS = currentPkts <= 0;

                // Smart Blended Volume: 60% Weight to 90-Day (Stability), 40% to 7-Day (Recency)
                // CRITICAL: If 7-day rate is severely suppressed (< 50% of 90-day), use 90-day only.
                // This protects against:
                // 1. OOS items whose sales are 0 because they weren't available
                // 2. Linked items (e.g., chutney) whose sales dropped because their parent items (momos) were OOS
                // 3. Supply chain disruptions that temporarily depressed sales
                const is7daySuppressed = dailyVol90 > 0 && dailyVol7 < dailyVol90 * 0.5;
                const blendedVol = is7daySuppressed
                    ? dailyVol90  // Use stable 90-day rate when 7-day is artificially low
                    : (dailyVol90 * 0.6) + (dailyVol7 * 0.4);

                // Safety Factor based on Order Popularity
                // If item is in Top 20% most ordered, add 15% safety buffer
                const freq = orderFrequencyMap[sku.id] || 0;
                let safetyMultiplier = 1.0;
                if (freq >= topTierThreshold && freq > 0) safetyMultiplier = 1.15;

                // BASE weighted demand from consumption history (this is the PRIMARY factor)
                let weightedDemand = blendedVol * safetyMultiplier;

                // IMPROVEMENT 1: Trend Multiplier - Boost items trending upward, reduce those trending down
                // BUT: Skip downward trend penalty for suppressed items (their low 7-day is due to external factors)
                let trendMultiplier = 1.0;
                if (dailyVol7 > dailyVol90 * 1.3) trendMultiplier = 1.15; // Strong upward trend
                else if (dailyVol7 > dailyVol90 * 1.1) trendMultiplier = 1.05; // Mild upward trend
                else if (dailyVol7 < dailyVol90 * 0.7 && !is7daySuppressed) trendMultiplier = 0.90; // Downward trend (only if NOT suppressed)
                weightedDemand *= trendMultiplier;

                // IMPROVEMENT 2 & 3: OOS and Shortfall use ADDITIVE boost (not multiplicative)
                // This prevents low-consumption OOS items from outranking high-consumption items
                // NOTE: currentPkts and isOOS are already defined above

                const volPerPkt = getVolumePerPacket(sku);
                const dailyVol = dailyVol7 > 0 ? dailyVol7 : dailyVol90;
                const minSafetyLitres = dailyVol * SAFETY_DAYS;
                const projectedStockLitres = projectedStocks[sku.id] || 0;
                const shortfall = Math.max(0, minSafetyLitres - projectedStockLitres);

                // Calculate an ADDITIVE boost based on urgency (OOS + shortfall)
                // This boost is proportional to the item's own consumption, not a flat multiplier
                let urgencyBoost = 0;
                if (isOOS && blendedVol > 0) {
                    // OOS items get a boost equal to 20% of their base demand
                    urgencyBoost += blendedVol * 0.20;
                }
                if (shortfall > 0 && minSafetyLitres > 0) {
                    // Shortfall adds up to 15% of base demand proportional to severity
                    const shortfallRatio = Math.min(1, shortfall / minSafetyLitres);
                    urgencyBoost += blendedVol * 0.15 * shortfallRatio;
                }
                weightedDemand += urgencyBoost;

                // BOOTSTRAP MODE: For first-time use when many items are OOS with no history
                // Give OOS items with no consumption history a meaningful base allocation
                // This ensures fair distribution on initial stock ordering
                if (weightedDemand === 0 && blendedVol === 0) {
                    if (isOOS) {
                        // OOS items with no history get baseline weight for initial stocking
                        weightedDemand = 1.5;
                    } else if (currentPkts < 2) {
                        // Critical low stock (< 2 pkts) but no history: gentle boost to keep shelf presentable
                        weightedDemand = 0.5;
                    }
                    // Else: If we have stock (>= 2 pkts) and NO sales, do not order more.
                    // This prevents overstocking "dead" inventory like Chicken Kurkure (17 pkts, 0 sales).
                }

                skuWeightedDemandMap[sku.id] = weightedDemand;
                totalWeightedDemand += weightedDemand;
            });

            // 7. Distribute Free Space based on Smart Weighted Demand
            relevantSkus.forEach(sku => {
                const volPerPkt = getVolumePerPacket(sku);

                // Share based on our Smart Weighted Demand
                const weightedDemand = skuWeightedDemandMap[sku.id] || 0;
                const share = totalWeightedDemand > 0 ? weightedDemand / totalWeightedDemand : 0;

                const litresToAdd = trueFreeLitres * share;
                const suggestPkts = Math.floor(litresToAdd / volPerPkt);

                // Meta data for display
                const weeklyLitres = Math.max(0, velocityLitresMap[sku.id] || 0);
                const dailyVol7 = weeklyLitres / 7;
                const dailyVol90 = Math.max(0, distributionLitresMap[sku.id] || 0) / 90;

                const projectedBurnLitres = dailyVol7 * daysUntilArrival;
                const currentPkts = stockMapPackets[sku.id] || 0;

                // Determine Trend
                let trend = 'stable';
                if (dailyVol7 > dailyVol90 * 1.1) trend = 'up'; // +10% increase
                else if (dailyVol7 < dailyVol90 * 0.9) trend = 'down'; // -10% decrease

                const isTopSeller = (orderFrequencyMap[sku.id] || 0) >= topTierThreshold && topTierThreshold > 0;

                // Include if suggestion > 0 OR if item is out of stock (even if suggestion 0, show it as OOS awareness)
                if (suggestPkts > 0 || currentPkts === 0) {
                    generated.push({
                        sku,
                        dailyAvgPackets: (dailyVol7 / volPerPkt).toFixed(1),
                        daysUntil: daysUntilArrival,
                        projectedBurnPackets: Math.ceil(projectedBurnLitres / volPerPkt),
                        currentPkts: Number(currentPkts.toFixed(1)), // Add current stock for display
                        suggestPkts,
                        originalQty: suggestPkts, // Baseline for user edits
                        isOOS: currentPkts === 0,
                        volPerPkt,
                        sharePercent: (share * 100).toFixed(1),
                        trend,
                        isTopSeller
                    });
                }
            });

            setGeneratedOrder(generated.sort((a, b) => b.suggestPkts - a.suggestPkts));
            setHasGenerated(true);
        } catch (err) {
            console.error("Generator Error", err);
            alert("An error occurred while generating the order. Please check the console.");
        } finally {
            setIsGenerating(false);
        }
    };

    // Wrapper to allow UI to render spinner before main thread locks
    const triggerGeneration = () => {
        setIsGenerating(true);
        setTimeout(runGenerator, 100);
    };

    const copyOrderToClipboard = () => {
        const text = generatedOrder.map(i => `${i.sku.name}: ${i.suggestPkts} pkts`).join('\n');
        const header = `Order for ${new Date(arrivalDate).toDateString()}\n------------------\n`;
        navigator.clipboard.writeText(header + text);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    const totalOrderValue = useMemo(() => {
        return generatedOrder.reduce((acc, item) => {
            const piecesPerPkt = (item.sku.piecesPerPacket && item.sku.piecesPerPacket > 0) ? item.sku.piecesPerPacket : 1;
            return acc + (item.suggestPkts * piecesPerPkt * (item.sku.costPrice || 0));
        }, 0);
    }, [generatedOrder]);

    // --- Manual Adjustment Logic ---
    const updateItemQuantity = (index: number, newQty: number) => {
        setGeneratedOrder(prev => {
            const next = [...prev];
            next[index] = { ...next[index], suggestPkts: Math.max(0, newQty) };
            return next;
        });
    };

    const currentTotalPkts = generatedOrder.reduce((acc, i) => acc + i.suggestPkts, 0);
    const originalTotalPkts = generatedOrder.reduce((acc, i) => acc + (i.originalQty || 0), 0);
    const capacityDiff = originalTotalPkts - currentTotalPkts;

    const fillSlack = () => {
        // IMPROVEMENT 4: Distribute slack proportionally across all items with suggestions
        if (capacityDiff <= 0) return;

        // Calculate total original qty to determine proportions
        const itemsWithSuggestions = generatedOrder.filter(i => i.originalQty > 0);
        const totalOriginal = itemsWithSuggestions.reduce((acc, i) => acc + i.originalQty, 0);

        if (totalOriginal === 0) {
            // Fallback: If no original suggestions, add to first top seller
            const topIdx = generatedOrder.findIndex(i => i.isTopSeller);
            if (topIdx >= 0) {
                updateItemQuantity(topIdx, generatedOrder[topIdx].suggestPkts + capacityDiff);
            }
            return;
        }

        // Distribute proportionally
        setGeneratedOrder(prev => {
            const next = [...prev];
            let remainingSlack = capacityDiff;

            itemsWithSuggestions.forEach(item => {
                const idx = prev.findIndex(p => p.sku.id === item.sku.id);
                if (idx >= 0 && remainingSlack > 0) {
                    const proportion = item.originalQty / totalOriginal;
                    const addition = Math.floor(capacityDiff * proportion);
                    next[idx] = { ...next[idx], suggestPkts: next[idx].suggestPkts + addition };
                    remainingSlack -= addition;
                }
            });

            // Add any rounding remainder to the top seller
            if (remainingSlack > 0) {
                const topIdx = prev.findIndex(i => i.isTopSeller);
                if (topIdx >= 0) {
                    next[topIdx] = { ...next[topIdx], suggestPkts: next[topIdx].suggestPkts + remainingSlack };
                }
            }

            return next;
        });
    };

    return (
        <div className="pb-24 max-w-5xl mx-auto">
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <Truck className="text-indigo-600" size={28} /> Stock Ordering
                    </h2>
                    <p className="text-slate-500 mt-1">Average-volume based ordering system.</p>
                </div>
                <button
                    onClick={() => {
                        setArrivalDate(getLocalISOString());
                        setIsGeneratorOpen(true);
                        setGeneratedOrder([]);
                        setHasGenerated(false);
                    }}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                >
                    <BarChart2 size={18} /> Generate Smart Order
                </button>
            </div>

            {/* Capacity Calculation Dashboard */}
            <section className="mb-8 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-white/10 rounded-lg">
                        <Calculator size={24} className="text-indigo-300" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">Capacity Calculator</h3>
                        <p className="text-xs text-slate-400">Total volume available for stock.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                    {/* Total Volume */}
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Fridge Capacity</p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-mono font-bold text-indigo-400">{totalCapacityPackets}</span>
                            <span className="text-sm font-medium text-slate-500">Std. Pkts</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">Approx. {totalCapacityLitres} Litres</p>
                    </div>

                    {/* Calculation Factor */}
                    <div className="flex flex-col justify-center">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Cuboid size={14} /> Standard Bag Volume
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={litresPerPacket}
                                onChange={handleVolumeChange}
                                onBlur={saveVolumeSetting}
                                className="w-full bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-lg font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-center"
                            />
                            <span className="absolute right-4 top-4 text-xs text-slate-500 font-bold">L/pkt</span>
                        </div>
                        <div className="flex items-center justify-center gap-1 mt-2">
                            <Info size={10} className="text-indigo-300" />
                            <p className="text-[10px] text-center text-slate-500">
                                Conversion factor to Standard Packets.
                            </p>
                        </div>
                    </div>

                    {/* Result */}
                    <div className="bg-indigo-600/20 rounded-xl p-4 border border-indigo-500/50 flex flex-col items-center justify-center text-center">
                        <p className="text-xs font-bold text-indigo-200 uppercase tracking-wider mb-1">Usage Status</p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-white">{usedCapacityPackets}</span>
                            <span className="text-sm font-medium text-indigo-300">/ {totalCapacityPackets} Pkts</span>
                        </div>
                        <p className="text-[10px] text-indigo-300/60 mt-1">
                            {Math.round((totalCapacityLitres - availableLitres) / totalCapacityLitres * 100)}% Full (Volume Based)
                        </p>
                    </div>
                </div>
            </section>

            {/* Order Recommendation Engine (Standard) */}
            <section className="mb-8">
                <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2 mb-4">
                    <Settings size={20} className="text-slate-400" /> Stock Analysis (90 Day Trend)
                </h3>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center text-sm">
                        <div className="flex gap-4">
                            <div>
                                <span className="text-slate-500">Current Stock Space: </span>
                                <span className="font-bold text-slate-800">{usedCapacityPackets} pkts</span>
                            </div>
                            <div>
                                <span className="text-slate-500">Free Space: </span>
                                <span className="font-bold text-emerald-600">{freeCapacityPackets} pkts</span>
                            </div>
                        </div>
                    </div>

                    {recommendedOrders.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 italic">
                            {availableLitres <= 0
                                ? "Fridge is physically full (0 Litres available). No space to order."
                                : "No items configured for deep freezer. Go to SKU Management to enable items."}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                                    <tr>
                                        <th className="p-4">Item Name</th>
                                        <th className="p-4 text-center">Current Stock</th>
                                        <th className="p-4 text-center">Volume Share</th>
                                        <th className="p-4 text-right">Recommended</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {recommendedOrders.map((rec, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                            <td className="p-4">
                                                <div className="font-bold text-slate-700">{rec.sku.name}</div>
                                                <div className="text-[10px] text-slate-400">{getVolumePerPacket(rec.sku)} L / pkt</div>
                                            </td>
                                            <td className="p-4 text-center text-slate-500">{Math.round(rec.currentPkts)} pkts</td>
                                            <td className="p-4 text-center text-slate-500">{(rec.consumptionShare * 100).toFixed(1)}%</td>
                                            <td className="p-4 text-right">
                                                {rec.recommendPkts > 0 ? (
                                                    <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold text-xs border border-emerald-200">
                                                        +{rec.recommendPkts} pkts
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 text-xs font-bold px-3">0 pkts</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <p className="text-xs text-slate-400 mt-2 italic px-1">
                    * Logic: 1.0L for Consumables, {litresPerPacket}L for Momos. Display uses Standard Packet units.
                </p>
            </section>

            {/* Storage Configuration Section */}
            <section>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                            <Box size={20} className="text-slate-400" /> Base Storage Configuration
                        </h3>
                        <p className="text-xs text-slate-500">Define the capacity of your base deep freezers.</p>
                    </div>
                    <button
                        onClick={handleAddNew}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <Plus size={16} /> Add Deep Freezer
                    </button>
                </div>

                {storageUnits.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-10 text-center flex flex-col items-center">
                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-300 mb-4">
                            <Snowflake size={32} />
                        </div>
                        <h4 className="text-lg font-bold text-slate-600">No Freezers Configured</h4>
                        <p className="text-slate-400 max-w-xs mx-auto mb-6">Add your base deep freezers and their capacity to start calculating stock requirements.</p>
                        <button onClick={handleAddNew} className="text-indigo-600 font-bold hover:underline">Add your first freezer</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {storageUnits.map(unit => (
                            <div key={unit.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                                        <Snowflake size={24} />
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEdit(unit)} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg"><Edit2 size={16} /></button>
                                        <button onClick={() => handleDelete(unit.id)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                                <h4 className="font-bold text-slate-800 text-lg mb-1">{unit.name}</h4>
                                <p className="text-sm text-slate-500 font-medium">Capacity: <span className="font-bold text-slate-700">{unit.capacityLitres} Litres</span></p>

                                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Type</span>
                                    <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">DEEP FREEZER</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Add/Edit Freezer Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800">{editingUnit.id ? 'Edit Freezer' : 'Add New Freezer'}</h3>
                            <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Freezer Name</label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    value={editingUnit.name || ''}
                                    onChange={(e) => setEditingUnit({ ...editingUnit, name: e.target.value })}
                                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                                    placeholder="e.g. Base Chest Freezer 1"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Capacity (Litres)</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={editingUnit.capacityLitres || ''}
                                    onChange={(e) => setEditingUnit({ ...editingUnit, capacityLitres: parseInt(e.target.value) })}
                                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                                    placeholder="e.g. 300"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 mt-2"
                            >
                                Save Configuration
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Generator Modal */}
            {isGeneratorOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in zoom-in-95 relative">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-indigo-50 shrink-0">
                            <div>
                                <h3 className="font-bold text-indigo-900 flex items-center gap-2"><BarChart2 size={18} /> Smart Order Generator</h3>
                                <p className="text-xs text-indigo-700">Predictive logic using Blended Trends (7d/90d) & Order Frequency</p>
                            </div>
                            <button onClick={() => setIsGeneratorOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto">
                            <div className="flex flex-col md:flex-row gap-4 mb-6 items-end">
                                <div className="flex-1 w-full">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Expected Stock Arrival Date</label>
                                    <div className="flex items-center border border-slate-300 rounded-xl px-3 py-2 bg-slate-50">
                                        <Calendar size={16} className="text-slate-400 mr-2" />
                                        <input
                                            type="date"
                                            value={arrivalDate}
                                            onChange={(e) => setArrivalDate(e.target.value)}
                                            className="bg-transparent w-full text-sm font-bold text-slate-700 outline-none"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        Logic: 60% weight to 90-day volume, 40% to 7-day velocity. Items frequently ordered (Top 20%) get a 15% safety buffer.
                                    </p>
                                </div>
                                <button
                                    onClick={triggerGeneration}
                                    disabled={isGenerating}
                                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md hover:bg-indigo-700 transition-colors w-full md:w-auto flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                                    {isGenerating ? 'Analyzing...' : 'Generate Suggestion'}
                                </button>
                            </div>

                            {generatedOrder.length > 0 ? (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="overflow-hidden border border-slate-200 rounded-xl">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                                                <tr>
                                                    <th className="p-3">Item</th>
                                                    <th className="p-3 text-center">Current Stock</th>
                                                    <th className="p-3 text-center">Daily Burn (7d)</th>
                                                    <th className="p-3 text-center">Proj. Stock (Arrival)</th>
                                                    <th className="p-3 text-right bg-emerald-50 text-emerald-700 w-32">Order Qty</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {generatedOrder.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50 group">
                                                        <td className="p-3 font-bold text-slate-700">
                                                            <div className="flex items-center gap-1.5">
                                                                {item.sku.name}
                                                                {item.isTopSeller && (
                                                                    <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5" title="High Order Frequency (Popular)">
                                                                        <Star size={8} fill="currentColor" /> Top
                                                                    </span>
                                                                )}
                                                                {item.trend === 'up' && (
                                                                    <span title="Consumption Trending Up (+10%)">
                                                                        <TrendingUp size={12} className="text-red-500" />
                                                                    </span>
                                                                )}
                                                                {item.trend === 'down' && (
                                                                    <span title="Consumption Trending Down (-10%)">
                                                                        <TrendingDown size={12} className="text-emerald-500" />
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="block text-[9px] text-slate-400 font-normal">{item.sharePercent}% of Ideal Mix</span>
                                                            {item.isOOS && (
                                                                <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase inline-block mt-0.5">OOS</span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-center text-slate-700 font-medium">
                                                            {item.currentPkts} pkts
                                                        </td>
                                                        <td className="p-3 text-center text-slate-500">{item.dailyAvgPackets} pkts</td>
                                                        <td className="p-3 text-center">
                                                            {item.projectedBurnPackets > 0 ? (
                                                                <span className="text-red-500 font-bold">-{item.projectedBurnPackets} used</span>
                                                            ) : (
                                                                <span className="text-slate-400">-</span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-right bg-emerald-50/30">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button
                                                                    onClick={() => updateItemQuantity(idx, item.suggestPkts - 1)}
                                                                    className="w-6 h-6 rounded bg-white border border-emerald-200 text-emerald-700 flex items-center justify-center hover:bg-emerald-100 transition-colors"
                                                                >
                                                                    <Minus size={12} />
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={item.suggestPkts}
                                                                    onChange={(e) => updateItemQuantity(idx, parseInt(e.target.value) || 0)}
                                                                    className="w-12 h-6 text-center border border-emerald-300 rounded text-xs font-bold text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                                />
                                                                <button
                                                                    onClick={() => updateItemQuantity(idx, item.suggestPkts + 1)}
                                                                    className="w-6 h-6 rounded bg-white border border-emerald-200 text-emerald-700 flex items-center justify-center hover:bg-emerald-100 transition-colors"
                                                                >
                                                                    <Plus size={12} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                                    {hasGenerated ? (
                                        <>
                                            <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
                                            <p className="font-bold text-slate-700">Fridge is Fully Stocked!</p>
                                            <p className="text-sm">Based on current trends and capacity, no new stock is needed.</p>
                                        </>
                                    ) : (
                                        <>
                                            <BarChart2 size={32} className="mx-auto mb-2 opacity-30" />
                                            <p>Select a date and click Generate.</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {generatedOrder.length > 0 && (
                            <div className="p-4 border-t border-slate-200 bg-white z-10 rounded-b-2xl shadow-[0_-10px_20px_rgba(0,0,0,0.05)] shrink-0">
                                {/* Capacity Adjuster: Under-utilized */}
                                {capacityDiff > 0 && (
                                    <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-2 flex justify-between items-center animate-fade-in-up">
                                        <div className="flex items-center gap-2 text-amber-800">
                                            <AlertCircle size={16} />
                                            <span className="text-xs font-bold">Unused Capacity: {capacityDiff} pkts</span>
                                        </div>
                                        <button
                                            onClick={fillSlack}
                                            className="bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                                        >
                                            <RefreshCcw size={12} /> Smart Distribute
                                        </button>
                                    </div>
                                )}

                                {/* Capacity Warning: Over-utilized */}
                                {capacityDiff < 0 && (
                                    <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-2 flex justify-between items-center animate-fade-in-up">
                                        <div className="flex items-center gap-2 text-red-800">
                                            <AlertTriangle size={16} />
                                            <span className="text-xs font-bold">Storage Overflow: {Math.abs(capacityDiff)} pkts</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-1 rounded">
                                            Exceeds Limit
                                        </span>
                                    </div>
                                )}

                                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                    <div className="flex gap-6 items-center">
                                        <div>
                                            <span className="text-xs font-bold text-slate-500 uppercase">Total Order</span>
                                            <p className="text-xl font-bold text-slate-800">
                                                {currentTotalPkts} pkts
                                            </p>
                                        </div>
                                        <div className="h-8 w-px bg-slate-200"></div>
                                        <div>
                                            <span className="text-xs font-bold text-slate-500 uppercase">Est. Value</span>
                                            <p className="text-xl font-bold text-emerald-600 flex items-center gap-0.5">
                                                <IndianRupee size={16} />{totalOrderValue.toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={copyOrderToClipboard}
                                        className="text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors border border-indigo-100"
                                    >
                                        {copySuccess ? <CheckCircle2 size={18} /> : <ClipboardCopy size={18} />}
                                        {copySuccess ? 'Copied!' : 'Copy List'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockOrdering;

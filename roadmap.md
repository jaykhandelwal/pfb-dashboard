# Project Roadmap

This document tracks upcoming features, technical debt, and architectural improvements for the Pakaja Dashboard.

| Date Created | Status | Deadline Date | Detailed Description |
| :--- | :--- | :--- | :--- |
| 2026-02-27 | **Technical Debt** | 2027-06-01 | **Database Aggregation Migration (The "Infinite Scale" Fix)**: Transition from client-side transaction calculations to Supabase SQL Views or Edge Functions. This is required before the `transactions` table exceeds 20,000–30,000 records to prevent `localStorage` limits and browser performance degradation. Implementation will involve creating SQL-based aggregate views for stock levels and dashboards. |

# Curriculum v2: research and design

The roadmap in `server/data/curriculum.js` has **336 problems in 37 topics, grouped into 6 phases**: 87 Easy, 205 Medium, 44 Hard. All of them are free (non-premium) LeetCode problems. It replaces v1 (182 problems, 22 topics). Every v1 problem and topic id is still in v2, so nobody loses progress.

## 1. What was compared

| Course / list | Size | Organized by | Good at | Weak at |
|---|---|---|---|---|
| Striver A2Z DSA Sheet | ~450 problems + theory | Data structure, beginner → advanced | Very thorough: basics, sorting, recursion, binary search on answers, DSU, DP sub-families | Long (4–6 months); some easy steps feel repetitive |
| NeetCode 150 / 250 | 150 / 250 | 18 pattern groups, each building on the last | Clear pattern order; widely used | Few basics; no sorting, union-find, segment-tree or string-algorithm topics |
| Blind 75 / Grind 75 / Grind 169 | 75 / 169 | Week by week | Covers what interviews ask most | Assumes you already know the basics |
| LeetCode 75 / Top Interview 150 (official) | 75 / 150 | ~22 technique groups | Classic, well-tested problems | LeetCode 75 has no Hard problems; neither is a learning order |
| Grokking the Coding Interview (Educative) | 28 patterns | Pattern (fast/slow, cyclic sort, top-K, topo sort, union-find…) | Names the pattern explicitly | Paid; not tied to LeetCode numbers |
| MIT 6.006 / CLRS | University course | Theory first: models → sorting → trees → hashing → graphs → DP | Proofs and complexity | Not interview-shaped; few practice problems |

## 2. What the research says about learning

- **Spaced practice works.** Spreading practice of the same skill over time beats cramming it, one of the best-supported results in learning science. The app already brings solved problems back after 3, 7, 21 and 60 days.
- **Interleaving helps you tell similar problems apart.** Practising mixed problem types helps you learn *which* method fits, not only how to run it. The effect is weaker or mixed in some maths studies, so v2 uses interleaving only at checkpoints, after the pattern has been learned in a blocked topic.
- **Blocked first, then mixed.** All the popular lists teach one pattern at a time (5–10 problems), and that is the right way to learn something new. Interviews, though, never tell you the pattern. v2 does both.

## 3. What changed from v1, and why

| Change | Why |
|---|---|
| New **Basics & Complexity** topic first | Striver and MIT both start with loops and Big-O; v1 dropped beginners straight into arrays |
| New **Sorting** topic (merge sort, counting sort, comparators, Reverse Pairs) | Missing from v1 and NeetCode; merge sort is the template for later divide-and-conquer and counting problems |
| New **Matrix** topic; Recursion moved into Phase 1 | Recursion is needed for merge sort and linked-list tricks, not only for trees |
| **Binary Search on the Answer** split from Binary Search | A different skill (search a monotonic yes/no function); Striver gives it its own section and it is common in online assessments |
| **Monotonic Stack & Deque** split from Stack | A distinct Grokking pattern; v1 hid it inside Stack |
| **Topological Sort** and **Union-Find** split out of Graphs | Both are separate patterns in Grokking and Striver; v1 had only 2 problems of each |
| Advanced graphs adds **Floyd–Warshall** and **Tarjan bridges** | Completes the shortest-path family |
| **Greedy and Intervals moved before DP** | Seeing greedy fail (Coin Change) is the clearest reason to learn DP |
| DP split into four: **1-D**, **2-D**, **Knapsack & LIS**, **States/Intervals/Trees/Bitmasks** | Matches Striver's DP families; v1 lumped knapsack and stock problems into 1-D/2-D |
| New **String Algorithms** (KMP), **Segment/Fenwick Tree**, **Design** topics | Gaps in NeetCode-style lists; design rounds (LRU, LFU, HashMap) are common |
| Three **Mixed Review** checkpoints | Interleaved practice: 28 unlabeled problems whose hints stay hidden until you ask |

## 4. The roadmap

**Phase 1 · Foundations** (52)
1. Basics & Complexity (6)
2. Arrays & Strings (9)
3. Hashing (9)
4. Prefix Sum (8)
5. Matrix (6)
6. Recursion Basics (7)
7. Sorting (7)

**Phase 2 · Core Patterns on Linear Data** (83)
8. Two Pointers (10)
9. Sliding Window (10)
10. Binary Search (11)
11. Binary Search on the Answer (6)
12. Linked List (18)
13. Stack & Queue (9)
14. Monotonic Stack & Deque (10)
15. Mixed Review I (9)

**Phase 3 · Trees, Heaps & Search** (56)
16. Binary Trees (21)
17. Binary Search Trees (9)
18. Heap / Priority Queue (8)
19. Backtracking (13)
20. Tries (5)

**Phase 4 · Graphs** (42)
21. Graphs: BFS & DFS (12)
22. Topological Sort (6)
23. Union-Find (6)
24. Shortest Paths & MST (9)
25. Mixed Review II (9)

**Phase 5 · Greedy & Dynamic Programming** (61)
26. Greedy (10)
27. Intervals (7)
28. 1-D DP (13)
29. 2-D DP: Grids & Strings (12)
30. DP: Knapsack & Subsequences (9)
31. DP: States, Intervals, Trees & Bitmasks (10)

**Phase 6 · Specialist Topics & Capstone** (42)
32. Bit Manipulation (9)
33. Math & Number Theory (6)
34. String Algorithms (5)
35. Segment Tree & Fenwick Tree (4)
36. Data Structure Design (8)
37. Capstone: Mixed Review III (10)

## 5. Pace

| Problems a day | Time to finish |
|---|---|
| 1 | ~11 months |
| 2 | ~5.5 months |
| 3 | ~4 months |

**Interview in under 3 months?** Pick *Start from topic* → Two Pointers (8) and do 3 a day. Phase 1 topics come back at the end, so nothing is lost.

## 6. How to study each problem

1. Spend 15–20 minutes trying it on your own before you open the hint.
2. Still stuck after 30–40 minutes? Read a solution, then close it and write the code yourself.
3. Say the time and space complexity out loud before you submit.
4. Mark it **Solved, revise later** if you needed the hint. It comes back sooner.

## Sources

- [Striver A2Z DSA Sheet guide](https://copilotinterview.com/blog/striver-a2z-dsa-sheet-guide)
- [Best DSA sheet for beginners: Blind 75, NeetCode 150, Grind 75](https://spacecomplexity.ai/blog/best-dsa-sheet-for-beginners)
- [Grind 75 vs Blind 75](https://www.dsaprep.dev/blog/best-dsa-sheet-for-beginners)
- [NeetCode roadmap guide](https://www.educative.io/blog/neetcode-roadmap), [NeetCode: how to prepare](https://blog.neetcode.io/p/prepare-coding-interviews), [NeetCode 250 list](https://github.com/iamBelugax/neetcode-250)
- [LeetCode Top Interview 150](https://leetcode.com/studyplan/top-interview-150/), [LeetCode 75 breakdown](https://github.com/RikamPalkar/leetcode-75)
- [Grokking the Coding Interview](https://www.educative.io/courses/grokking-the-coding-interview), [Educative: top LeetCode patterns](https://www.educative.io/blog/coding-interview-leetcode-patterns)
- [MIT 6.006 syllabus (Fall 2011)](https://www.ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/pages/syllabus)
- [Chen et al. 2021, Spacing and interleaving effects](https://link.springer.com/article/10.1007/s10648-021-09613-w)
- [Weinstein et al. 2018, Teaching the science of learning](https://link.springer.com/article/10.1186/s41235-017-0087-y)
- [Rohrer & Hartwig: spaced and interleaved mathematics practice](https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-spaced-and-interleaved-mathematics-practice-rohrer-hartwig.pdf)
- [Loughborough: spaced and interleaved practice in maths (mixed evidence)](https://blog.lboro.ac.uk/cmc/?p=577)
- [techinterview.org: patterns by frequency](https://www.techinterview.org/post/3233474682/leetcode-patterns-by-frequency/)

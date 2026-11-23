// Cheat-sheet notes for the revision sheet, one entry per roadmap topic.
//   spot:       how to recognise that a problem needs this topic
//   ideas:      the key ideas / templates to remember
//   pitfalls:   common mistakes
//   complexity: typical time and space cost

const PICK_PATTERN = {
  spot: 'A mixed set: the problem does not tell you the pattern.',
  ideas: [
    'Sorted input or a monotonic "can I do it with X?" → binary search.',
    'Contiguous subarray/substring → sliding window or prefix sums (negatives → prefix sums).',
    'Pairs in sorted data → two pointers. Fast lookups or counts → hash map.',
    '"Next greater/smaller" → monotonic stack. Top-K or repeated min/max → heap.',
    'Trees/graphs: shortest steps → BFS; explore all / paths → DFS; dependencies → topo sort; connectivity → union-find.',
    'All combinations → backtracking. Optimal count/value with overlapping choices → DP. Provable local choice → greedy.',
  ],
  pitfalls: ['Read the constraints: n ≤ 20 allows 2^n, n ≤ 10^5 needs O(n log n) or better.'],
  complexity: 'Match the constraints: 10^8 simple operations per second is a safe rule of thumb.',
};

export const REVISION_NOTES = {
  basics: {
    spot: 'Simple loops over digits or a range; the question is mostly about cost.',
    ideas: ['Get digits with n % 10 and n / 10.', 'Count operations to estimate Big-O before coding.', 'Sieve of Eratosthenes for many primes.'],
    pitfalls: ['Integer overflow when reversing or multiplying.', 'Off-by-one in loop bounds.'],
    complexity: 'Digit loops O(log n); sieve O(n log log n).',
  },
  arrays: {
    spot: 'One pass over an array or string, often in place.',
    ideas: ['Track a running best (min so far, max profit).', 'Write pointer for in-place filtering.', "Kadane's: reset the running sum when it goes negative.", 'Prefix × suffix products instead of division.'],
    pitfalls: ['Modifying the array while you still need old values.', 'Empty or single-element input.'],
    complexity: 'Usually O(n) time, O(1) extra space.',
  },
  hashing: {
    spot: '"Have I seen this?", counting, grouping, or pairing values.',
    ideas: ['Map value → index for complement lookups (Two Sum).', 'Frequency map / 26-slot array for anagrams.', 'Canonical key (sorted word, count tuple) to group items.', 'Only start a sequence where x-1 is missing.'],
    pitfalls: ['Using a list as a map key (convert to a tuple or string).', 'Forgetting duplicates when counting.'],
    complexity: 'O(n) time, O(n) space.',
  },
  'prefix-sum': {
    spot: 'Many range-sum queries, or "count subarrays with sum / remainder = k".',
    ideas: ['pre[i+1] = pre[i] + a[i]; sum(l..r) = pre[r+1] - pre[l].', 'Count prefix sums in a map; look up sum - k.', 'Same remainder mod k twice → divisible subarray between them.', '2-D: inclusion-exclusion.'],
    pitfalls: ['Seed the map with {0: 1}.', 'Negative remainders: use ((x % k) + k) % k.'],
    complexity: 'O(n) build, O(1) per query.',
  },
  matrix: {
    spot: 'Grids: rotate, traverse in layers, or mark rows/columns.',
    ideas: ['Rotate 90° = transpose + reverse each row.', 'Spiral: four shrinking bounds.', 'Use the first row/column as marker storage for O(1) space.', 'Encode old and new state in one cell.'],
    pitfalls: ['Mixing up rows (m) and columns (n).', 'Overwriting cells you still need to read.'],
    complexity: 'O(m·n).',
  },
  recursion: {
    spot: 'The problem is defined in terms of a smaller version of itself.',
    ideas: ['Write the base case first, then trust the smaller call.', 'Fast power: x^n = (x^(n/2))², halve n each step.', 'Memoize when the same arguments repeat.'],
    pitfalls: ['Missing or wrong base case → infinite recursion.', 'Deep recursion can overflow the stack (n > ~10^4).'],
    complexity: 'Calls × work per call; fast power O(log n).',
  },
  sorting: {
    spot: 'Order makes the problem easy, or you need counts across halves.',
    ideas: ['Merge sort: split, sort halves, merge; count cross pairs while merging.', 'Counting sort for small value ranges.', 'Custom comparator (e.g. a+b vs b+a).', 'Dutch flag: low / mid / high pointers.'],
    pitfalls: ['Comparators must be consistent.', 'Sorting loses original indexes; keep (value, index) pairs.'],
    complexity: 'O(n log n); counting sort O(n + range).',
  },
  'two-pointers': {
    spot: 'Sorted array, pairs/triplets, palindromes, or in-place partitioning.',
    ideas: ['Opposite ends: move the side that cannot be part of a better answer.', 'Sort first, fix one value, two-pointer the rest (3Sum).', 'Same direction: slow writer, fast reader.'],
    pitfalls: ['Skipping duplicates in k-Sum problems.', 'Moving both pointers when only one should move.'],
    complexity: 'O(n) after an O(n log n) sort.',
  },
  'sliding-window': {
    spot: 'Longest/shortest contiguous subarray or substring with a condition.',
    ideas: ['Grow right; shrink left while the window is invalid.', 'Fixed size k: add one, remove one.', 'exactly(k) = atMost(k) - atMost(k-1).', 'Keep counts in a map; track how many requirements are met.'],
    pitfalls: ['Does not work with negative numbers for sum targets (use prefix sums).', 'Update the answer at the right moment (before or after shrinking).'],
    complexity: 'O(n): each index enters and leaves once.',
  },
  'binary-search': {
    spot: 'Sorted (or rotated sorted) data, or a peak/boundary to find.',
    ideas: ['Lower bound: first index where condition is true.', 'Rotated array: one half is always sorted.', 'mid = lo + (hi - lo) / 2.'],
    pitfalls: ['Infinite loops: make sure lo or hi always moves.', 'Choosing lo <= hi vs lo < hi inconsistently.'],
    complexity: 'O(log n).',
  },
  'bs-answer': {
    spot: '"Minimum capacity / speed / max-sum such that…" with a yes/no check that is monotonic.',
    ideas: ['Search the answer range [lo, hi], not the array.', 'Write feasible(x) greedily in O(n).', 'Minimise → find first feasible; maximise → last feasible.'],
    pitfalls: ['Wrong search bounds (lo = max element, hi = total sum).', 'Overflow in the feasibility sum.'],
    complexity: 'O(n log(range)).',
  },
  'linked-list': {
    spot: 'Rewiring nodes, finding the middle or a cycle, merging lists.',
    ideas: ['Dummy head node simplifies edge cases.', 'Reverse: prev, curr, next.', 'Fast/slow pointers: middle, cycle, cycle start.', 'Split + reverse + merge for reorder/palindrome.'],
    pitfalls: ['Losing the next pointer before rewiring.', 'Null checks on fast.next.'],
    complexity: 'O(n) time, O(1) space.',
  },
  stack: {
    spot: 'Matching brackets, undo, nested structures, expression evaluation.',
    ideas: ['Push openers; each closer must match the top.', 'Store (value, min so far) for O(1) min.', 'Nested decode: push state at "[", pop at "]".', 'Two stacks make a queue.'],
    pitfalls: ['Popping an empty stack.', 'Leftover items at the end mean the input was invalid.'],
    complexity: 'O(n).',
  },
  'monotonic-stack': {
    spot: '"Next greater / smaller element", spans, or largest rectangle.',
    ideas: ['Keep the stack increasing or decreasing; pop while the new value breaks the order.', 'Each popped item gets its answer from the current index.', 'Monotonic deque for sliding-window max.', 'Circular arrays: loop twice with i % n.'],
    pitfalls: ['Store indexes, not values, when you need distances.', 'Strict vs non-strict comparison changes duplicate handling.'],
    complexity: 'O(n): each item is pushed and popped once.',
  },
  'review-1': PICK_PATTERN,
  trees: {
    spot: 'Hierarchical data: depth, paths, views, ancestors.',
    ideas: ['DFS returns a value up (height, sum); update a global answer on the way.', 'BFS level by level for widths, views and levels.', 'Pass state down (max so far, remaining sum).', 'LCA: the node where p and q split.'],
    pitfalls: ['Confusing "path through the node" with "path down from the node".', 'Forgetting the null base case.'],
    complexity: 'O(n) time, O(h) recursion space.',
  },
  bst: {
    spot: 'Binary search tree: ordered searching, inserting, k-th smallest.',
    ideas: ['Inorder traversal is sorted.', 'Validate with (low, high) bounds, not just parent comparisons.', 'Delete with two children: replace with the inorder successor.'],
    pitfalls: ['Checking only direct children when validating.', 'Skewed trees make operations O(n).'],
    complexity: 'O(h): O(log n) balanced, O(n) worst.',
  },
  heap: {
    spot: 'Top-K, k-th largest, repeated min/max, merging sorted streams, scheduling.',
    ideas: ['Min-heap of size k keeps the k largest.', 'Two heaps for a running median.', 'Greedy + heap: always take the best available option.'],
    pitfalls: ['Using a min-heap where you need a max-heap (negate values).', 'Heapify is O(n), pushing n items is O(n log n).'],
    complexity: 'O(log n) per push/pop; top-K O(n log k).',
  },
  backtracking: {
    spot: 'Generate all subsets, permutations, combinations, or board placements.',
    ideas: ['choose → recurse → un-choose.', 'Pass a start index to avoid reusing earlier items.', 'Sort and skip duplicates at the same depth.', 'Prune as early as possible.'],
    pitfalls: ['Appending the same list object instead of a copy.', 'Forgetting to undo the choice.'],
    complexity: 'Exponential: O(2^n) subsets, O(n!) permutations.',
  },
  tries: {
    spot: 'Many words with shared prefixes, autocomplete, or bitwise XOR maximisation.',
    ideas: ['Node = children map + end-of-word flag.', 'Wildcard: try every child.', 'Binary trie: greedily take the opposite bit for max XOR.'],
    pitfalls: ['Marking end-of-word only at the last node.', 'Memory use with many words.'],
    complexity: 'O(L) per word operation.',
  },
  graphs: {
    spot: 'Nodes and edges, grids as graphs, connected components, shortest steps.',
    ideas: ['Build an adjacency list first.', 'BFS for the shortest path in unweighted graphs.', 'Multi-source BFS: push all sources at the start.', 'Two-colouring for bipartite checks.'],
    pitfalls: ['Marking visited when you pop instead of when you push (duplicates in BFS).', 'Out-of-bounds checks on grids.'],
    complexity: 'O(V + E); grids O(m·n).',
  },
  'topo-sort': {
    spot: 'Tasks with prerequisites, ordering, or cycle detection in a directed graph.',
    ideas: ["Kahn's: queue nodes with indegree 0, reduce neighbours' indegrees.", 'Fewer than V nodes processed → there is a cycle.', 'DFS with three colours also detects cycles.'],
    pitfalls: ['Edge direction: prerequisite → course.', 'Isolated nodes still need to appear in the order.'],
    complexity: 'O(V + E).',
  },
  'union-find': {
    spot: 'Dynamic connectivity, grouping, counting components, redundant edges.',
    ideas: ['find with path compression, union by rank/size.', 'Union returns false if already connected → that edge makes a cycle.', 'Components = n - successful unions.'],
    pitfalls: ['Comparing nodes instead of their roots.', 'Mapping non-integer items (emails, coordinates) to ids.'],
    complexity: 'Almost O(1) per operation (inverse Ackermann).',
  },
  'advanced-graphs': {
    spot: 'Weighted shortest paths, minimum spanning trees, bridges.',
    ideas: ['Dijkstra: min-heap of (dist, node); skip stale entries.', 'Bellman-Ford for k edges or negative weights.', 'Floyd-Warshall for all pairs (small n).', "Prim's or Kruskal's for MST."],
    pitfalls: ['Dijkstra fails with negative edges.', 'Bellman-Ford with k stops must copy the distance array each round.'],
    complexity: 'Dijkstra O(E log V); Floyd O(V³).',
  },
  'review-2': PICK_PATTERN,
  greedy: {
    spot: 'A local choice can be proven safe: furthest reach, earliest end, smallest that fits.',
    ideas: ['Sort first, then take the best option each step.', 'Track a reach or balance as you scan.', 'Prove it with an exchange argument; if you can not, try DP.'],
    pitfalls: ['Greedy that looks right but fails (Coin Change with odd coins).'],
    complexity: 'Usually O(n log n) for the sort.',
  },
  intervals: {
    spot: 'Ranges that overlap, merge, or need the fewest removals / arrows.',
    ideas: ['Merge: sort by start.', 'Max non-overlapping / arrows: sort by end and keep the earliest end.', 'Two pointers for intersecting two sorted lists.'],
    pitfalls: ['Touching endpoints: decide if [1,2] and [2,3] overlap.'],
    complexity: 'O(n log n).',
  },
  'dp-1d': {
    spot: 'Count ways or find the best value, and choices at step i depend on a few earlier steps.',
    ideas: ['Define dp[i] in words first.', 'Recurrence from the last choice (take / skip).', 'Top-down memo → bottom-up table → O(1) rolling variables.'],
    pitfalls: ['Wrong base cases (dp[0], dp[1]).', 'Using greedy where DP is needed.'],
    complexity: 'O(n · choices).',
  },
  'dp-2d': {
    spot: 'Grids, or two strings compared index by index (LCS, edit distance).',
    ideas: ['dp[i][j] for prefixes s[:i], t[:j].', 'Equal chars → diagonal; otherwise min/max of neighbours.', 'Roll to one row when only the previous row is needed.'],
    pitfalls: ['Off-by-one between dp indexes and string indexes.', 'Initialising the first row/column.'],
    complexity: 'O(m·n) time, O(n) with rolling rows.',
  },
  'dp-knapsack': {
    spot: 'Pick items under a capacity, reach a target sum, or longest increasing subsequence.',
    ideas: ['0/1 knapsack: loop capacity backwards.', 'Unbounded: loop capacity forwards.', 'Count combinations: coins outer loop; permutations: amount outer loop.', 'LIS in O(n log n) with patience sorting.'],
    pitfalls: ['Loop direction decides 0/1 vs unbounded.', 'Target sum: (total + target) must be even and non-negative.'],
    complexity: 'O(n · capacity); LIS O(n log n).',
  },
  'dp-advanced': {
    spot: 'States per day (holding / not), ranges i..j, choices on trees, or small sets (n ≤ 20).',
    ideas: ['State machine: one variable per state, update each day.', 'Interval DP: choose the last action in [i, j].', 'Tree DP: return (take, skip) from each node.', 'Bitmask DP over subsets.'],
    pitfalls: ['Updating states in the wrong order on the same day.', 'Interval DP loops must go by increasing length.'],
    complexity: 'Interval O(n³); bitmask O(2^n · n).',
  },
  bits: {
    spot: 'XOR pairs, single numbers, powers of two, counting set bits.',
    ideas: ['x ^ x = 0; XOR everything to find the odd one out.', 'n & (n-1) clears the lowest set bit.', 'x & -x isolates the lowest set bit.', 'Count bits per position mod k.'],
    pitfalls: ['Signed shifts and negative numbers in your language.'],
    complexity: 'O(n) or O(32 · n).',
  },
  math: {
    spot: 'Digits, GCD, factorials, modular arithmetic, slopes.',
    ideas: ['gcd(a, b) = gcd(b, a % b).', 'Trailing zeros of n! = count of factor 5.', 'Represent slopes as reduced (dy, dx) pairs, not floats.'],
    pitfalls: ['Floating-point precision.', 'Overflow before taking the modulus.'],
    complexity: 'GCD O(log n).',
  },
  'string-algorithms': {
    spot: 'Find a pattern in text in linear time, or a longest prefix that is also a suffix.',
    ideas: ['KMP prefix function (lps): longest proper prefix that is also a suffix.', 'Search: run lps on pattern + "#" + text.', 'Rolling hash for quick substring comparison.'],
    pitfalls: ['Hash collisions: double-check matches.', 'Building lps with the wrong fallback (j = lps[j-1]).'],
    complexity: 'O(n + m).',
  },
  'range-queries': {
    spot: 'Range sums/mins with updates in between, or counting smaller elements.',
    ideas: ['Fenwick tree: i += i & -i to update, i -= i & -i to query.', 'Segment tree for any associative operation.', 'Coordinate-compress large values first.'],
    pitfalls: ['Fenwick trees are 1-indexed.', 'Segment tree arrays need 4n space.'],
    complexity: 'O(log n) per query and update.',
  },
  design: {
    spot: '"Design a class that supports these operations in O(1)".',
    ideas: ['Hash map + doubly linked list = LRU.', 'Array + index map for O(1) random delete.', 'Frequency buckets + min frequency = LFU.', 'Pick structures per operation, then combine.'],
    pitfalls: ['Keeping the two structures in sync on every operation.'],
    complexity: 'O(1) or O(log n) per operation.',
  },
  'review-3': PICK_PATTERN,
};

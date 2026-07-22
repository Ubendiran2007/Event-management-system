## Optimization Rule
- Proactively optimize each and every line of code (both existing and new) for performance, bandwidth, and efficiency without waiting for explicit user prompts.

## UI Layout and Scrolling Rule
- ALWAYS use CSS Flexbox (`flex-1 min-h-0`) to structure full-height layouts and allow scrollable inner containers, rather than using brittle CSS `calc(100vh - Xpx)`. Using `calc()` for height often results in unexpected outer scrollbars due to padding and margins. Ensure the parent container has `h-full flex flex-col min-h-0` to properly contain the flexible children.

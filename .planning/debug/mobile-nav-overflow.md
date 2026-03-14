---
status: diagnosed
trigger: "Nav links function but overflow makes the page wider at 375px"
created: 2026-03-07T18:00:00Z
updated: 2026-03-07T18:00:00Z
---

## Current Focus

hypothesis: .nav-links has no flex-wrap layout and no overflow containment; 11 inline links with horizontal margins exceed 375px available width, expanding the page
test: confirmed via CSS analysis
expecting: n/a (confirmed)
next_action: return diagnosis

## Symptoms

expected: At 375px viewport, nav links wrap or scroll without making the page wider
actual: Nav links function but overflow makes the page wider at 375px
errors: None
reproduction: Test 7 in UAT - switch to 375px viewport in DevTools
started: Discovered during UAT

## Eliminated

(none -- root cause identified on first hypothesis)

## Evidence

- timestamp: 2026-03-07T18:00:00Z
  checked: .nav-links CSS rules (style.css lines 399-411)
  found: ".nav-links has only margin-top:0.5rem. No display:flex, no flex-wrap, no overflow-x. Links are inline <a> elements with margin:0 0.5rem each."
  implication: "11 links as inline elements wrap via normal flow, but have no overflow containment. Each link adds 1rem of horizontal margin."

- timestamp: 2026-03-07T18:00:00Z
  checked: "#shared-nav CSS (style.css line 3107-3109)"
  found: "#shared-nav only has min-height:80px. No overflow, no max-width, no width constraint."
  implication: "Container does nothing to prevent content from expanding beyond viewport."

- timestamp: 2026-03-07T18:00:00Z
  checked: "body CSS (style.css lines 22-29)"
  found: "body has max-width:800px, margin:0 auto, padding:1rem. No overflow-x:hidden."
  implication: "At 375px, available content width is 375-32=343px. body does not clip horizontal overflow."

- timestamp: 2026-03-07T18:00:00Z
  checked: "buildNavLinksHTML() in shared-nav.js (line 160)"
  found: "Renders <nav class='nav-links' style='margin-top:0.75rem;'> with 11 <a> children, no wrapping container, no scroll wrapper."
  implication: "JS adds no structural help for mobile layout."

- timestamp: 2026-03-07T18:00:00Z
  checked: "All @media queries in style.css"
  found: "No mobile breakpoint targets .nav-links at all. Breakpoints exist at 960px, 900px, 700px, 640px, 600px, 500px -- none address .nav-links or #shared-nav."
  implication: "Nav links have zero responsive behavior."

- timestamp: 2026-03-07T18:00:00Z
  checked: "overflow properties across entire stylesheet"
  found: "No overflow-x rule on body, #shared-nav, or .nav-links anywhere in the file."
  implication: "Nothing prevents the inline nav links from pushing the document width past the viewport."

## Resolution

root_cause: ".nav-links lacks flex layout with wrapping AND lacks overflow containment. The 11 inline <a> elements (each with margin:0 0.5rem = 1rem total per link) render as inline text that wraps via normal flow, but because neither .nav-links, #shared-nav, nor body has overflow-x:hidden or overflow-x:auto, the wrapped lines of links that slightly exceed the container width push the entire page wider than 375px. The fix requires either (a) making .nav-links a flex container with flex-wrap:wrap and constraining overflow, or (b) making it a horizontal scroll container with overflow-x:auto and white-space:nowrap."
fix: ""
verification: ""
files_changed: []

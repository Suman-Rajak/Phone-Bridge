# PhoneBridge UI

## Visual language

Use the shared React components in `apps/web/src/ui/` and the Tailwind theme in `apps/web/src/styles.css`. The default theme follows the device setting. The gallery can preview either theme explicitly.

| Role             | Light     | Dark      |
| ---------------- | --------- | --------- |
| Canvas           | `#f4f7f6` | `#101b17` |
| Surface          | `#ffffff` | `#172620` |
| Subtle surface   | `#edf2f0` | `#22332b` |
| Text             | `#152822` | `#eaf5ef` |
| Secondary text   | `#4d6259` | `#b4c7bb` |
| Border           | `#d5e0da` | `#3a4e43` |
| Action and focus | `#12634d` | `#85dfb8` |
| Accent surface   | `#def0e7` | `#244b3b` |
| Error text       | `#8d302a` | `#ffb7ae` |
| Error surface    | `#f9e9e6` | `#482e2b` |

- Use the system sans stack. Labels range from 12 to 14 px, body text from 14 to 18 px, screen headings from 29 to 44 px, and the laptop pairing heading from 42 to 80 px.
- Lay out controls and content on a 4 px spacing grid. Use 12 px corner radii for controls and 24 px for panels. Panels use a soft shadow that adapts to the theme.
- Keep control hit targets at least 44 × 44 px. Use Lucide stroke icons with text or an accessible name. Mark redundant icons as decorative.
- Use 180 ms for transitions. Remove decorative transitions and spinner rotation when reduced motion is requested.
- Use labelled controls, visible focus, and WCAG AA contrast. Announce success and progress with status text. Explain what happened and give a next step after an error or permission denial.
- Camera overlays use shared green and amber tokens in both themes. Use a solid green outline for a page lock and a dashed amber outline for an estimated boundary. Pair each outline with written status.

## Shared components

Use Button for actions, Card for grouped content, and Status pill for short connection labels. Use Drawer for supplementary controls or Advanced connection details and Modal for actions that need a decision. Use Progress bar for measurable work, Spinner for indeterminate work, and Skeleton where a layout is known. Tabs change visible panels, while Segmented control chooses one setting. Use Empty state for a view with no content, Error state for a failed action, and Toast for brief feedback after success.

## Screens

| Screen              | Layout                                                                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Laptop home         | A connection label in the header, a pairing card, and three pairing steps. The unpaired shell gives way to the active tool after pairing is implemented. |
| Phone shell         | A tool heading, a workspace, and an always-accessible bottom tool bar. Camera modes will use the available workspace for the preview.                    |
| Scanner             | Camera preview and shutter on the phone. A page tray, page editor, and export controls on the laptop.                                                    |
| Document camera     | Live preview on the phone, with page controls near the bottom. A large flattened preview on the laptop.                                                  |
| Presenter           | Slides and pointer on the laptop. Large previous, next, and laser controls on the phone.                                                                 |
| Drawing tablet      | Full-width drawing surface on the phone. A whiteboard or slide with the ink overlay on the laptop.                                                       |
| Clipboard and files | Text and file actions near the incoming items. Use progress and cancel controls for transfers.                                                           |
| Advanced            | A drawer opened from connection status. Connection details and a copy action stay in the drawer.                                                         |
| Browser diagnostics | A capability table with display-only status pills. Show HTTPS guidance above the table and alternatives alongside unavailable features.                  |
| Component gallery   | A development-only view of the shared components, with a system, light, and dark theme selector.                                                         |

Review laptop and phone screenshots at 1440 × 900 and 390 × 844 before opening a UI PR. Also test the phone layout at 360 px without horizontal scrolling. Run axe on the relevant screens and overlays.

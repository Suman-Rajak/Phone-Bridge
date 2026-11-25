# PhoneBridge repository skills

Codex discovers repository skills from `.agents/skills/`. Launch Codex in this checkout or one of its subdirectories and select the skill with `$` in a prompt. Codex can also select the skill automatically when its description matches the task. [Official Codex skills documentation](https://learn.chatgpt.com/docs/build-skills)

| Skill                                                                      | Use                                                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [add-protocol-message](../../.agents/skills/add-protocol-message/SKILL.md) | Add or revise a message with its tests and wire documentation.                       |
| [vision-bench](../../.agents/skills/vision-bench/SKILL.md)                 | Run SmartDoc, report mean IoU and frame count, and compare with a matching baseline. |
| [bug-fix](../../.agents/skills/bug-fix/SKILL.md)                           | Reproduce a regression and link the verified fix from the bug log.                   |

Later uses appear in the task session evidence and in the corresponding Codex commit trailers.

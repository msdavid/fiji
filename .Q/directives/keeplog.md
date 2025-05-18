<directive>
## DIRECTIVE: AI-OPTIMIZED WORKLOG MAINTENANCE

**OBJECTIVE:** Maintain a structured, machine-parseable worklog in `.Q/worklog.md`. This log is **critical** for inter-session context preservation, enabling this or another AI agent to resume work efficiently. Prioritize data density and predictable structure.

**FILE:** `.Q/worklog.md` (Append-only during active work blocks).

**FORMAT & STRUCTURE:** Markdown with an emphasis on structured data. Use consistent keywords and delimiters. Each significant state change or log entry MUST begin with a `LOG_ENTRY_TIMESTAMP: YYYY-MM-DD HH:MM:SS UTC` marker.

**CORE CONTENT REQUIREMENTS (Machine-Focused):**

1.  **SESSION_MARKERS:**
    * `SESSION_START_TIMESTAMP: YYYY-MM-DD HH:MM:SS UTC`
        * `INITIAL_STATE_ASSESSMENT: [Brief summary or keywords describing project state upon resuming, based on previous log]`
    * `SESSION_END_TIMESTAMP: YYYY-MM-DD HH:MM:SS UTC`
        * `FINAL_STATE_SUMMARY: [Keywords/data points summarizing work done and current state]`

2.  **CONTEXT_BLOCK:** (Update frequently within a session)
    * `CURRENT_GOAL_ID: [Unique identifier or concise description of the immediate objective]`
    * `ACTIVE_FILES: [comma-separated list of file paths, e.g., "src/module_a.py,tests/test_module_a.py"]`
    * `RELEVANT_ARTIFACTS: [e.g., function names, class names, API endpoints being modified/created, specific variables/data structures of focus]`
    * `KEY_PARAMETERS: [Critical configuration, input values, or constraints affecting current task]`
    * `DECISION_LOGIC: [If a significant choice is made, log as "DECISION: [ChoiceMade]; REASON: [ConciseReasoning]; ALTERNATIVES_CONSIDERED: [Alt1, Alt2]"]`

3.  **ACTION_LOG:** (Log granular actions)
    * `ACTION_TIMESTAMP: YYYY-MM-DD HH:MM:SS UTC`
    * `ACTION_TYPE: [e.g., IMPLEMENT_FUNCTION, REFACTOR_CODE, EXECUTE_TEST, DEBUG_ISSUE, WRITE_DOCS, CREATE_FILE, MODIFY_FILE]`
    * `TARGET: [e.g., function_name, class_name, file_path, specific_line_numbers]`
    * `DESCRIPTION: [Concise summary of action taken and outcome. Include outputs or state changes if brief.]`
    * `STATUS: [e.g., COMPLETED, FAILED, IN_PROGRESS]`
    * `OUTPUT_SNIPPET: [If relevant, a very brief code/data snippet, or path to a more detailed output if too large]`

4.  **TASK_QUEUE:** (Maintain a persistent list)
    * Use a structured list format. Each task should have:
        * `TASK_ID: [Unique ID for the task]`
        * `DESCRIPTION: [Clear, actionable task description]`
        * `STATUS: [PENDING | IN_PROGRESS | COMPLETED | BLOCKED]`
        * `PRIORITY: [HIGH | MEDIUM | LOW]`
        * `DEPENDENCIES: [List of TASK_IDs this task depends on, or "NONE"]`
        * `ASSIGNED_TO: [AI_AGENT | HUMAN_REVIEW_REQUIRED]`
    * Example:
        ```
        TASK_ID: T001
        DESCRIPTION: Implement user registration endpoint.
        STATUS: PENDING
        PRIORITY: HIGH
        DEPENDENCIES: NONE
        ASSIGNED_TO: AI_AGENT
        ---
        TASK_ID: T002
        DESCRIPTION: Add unique constraint to email field in DB.
        STATUS: BLOCKED
        PRIORITY: HIGH
        DEPENDENCIES: T001
        ASSIGNED_TO: AI_AGENT
        ```

5.  **ISSUE_TRACKER:**
    * `ISSUE_ID: [Unique ID]`
    * `ENCOUNTER_TIMESTAMP: YYYY-MM-DD HH:MM:SS UTC`
    * `DESCRIPTION: [Detailed description of the issue, error, or unexpected behavior]`
    * `ERROR_SIGNATURE: [Key parts of error messages, stack traces, or unique identifiers of the error]`
    * `AFFECTED_COMPONENTS: [Files, functions, modules affected]`
    * `SEVERITY: [CRITICAL | HIGH | MEDIUM | LOW]`
    * `STATUS: [OPEN | RESOLVED | WORKAROUND_APPLIED]`
    * `RESOLUTION_ATTEMPTS: [Log of attempts to fix, if any]`
    * `PROPOSED_SOLUTION: [If any, briefly state]`

6.  **NEXT_ACTIONS_PLAN:**
    * `IMMEDIATE_NEXT_ACTION_ID: [TASK_ID from TASK_QUEUE or concise description]`
    * `SHORT_TERM_STRATEGY: [Keywords or brief plan for the next 1-3 significant actions/tasks]`

**OPERATIONAL EMPHASIS:**

* **ATOMICITY & FREQUENCY:** Log entries should be frequent and reflect granular changes. Prefer many small, structured entries over large, monolithic blocks.
* **CONSISTENCY:** Strictly adhere to the keywords and structure outlined. This is paramount for parsing.
* **DATA_OVER_PROSE:** Favor structured data, lists, and keywords. Avoid conversational language.
* **STATEFULNESS:** Ensure the log accurately reflects the evolving state of the codebase and the agent's understanding.

This directive is to be followed precisely. The integrity of the worklog is essential for operational continuity.

</directive>

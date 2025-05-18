<directive>
## AI Codebase Documentation & Context Generation (Multi-Document for Large Codebases)

**Objective:** Analyze the provided codebase and generate a structured "Codebase Knowledge Pack" (CKP). For large codebases with distinct major architectural components, this CKP will consist of:
1.  An **Overview Document** (`CKP_Overview.md`).
2.  Separate **Component-Specific Documents** (`CKP_Component_[ComponentName].md`) for each identified major architectural component.

This CKP will serve as the primary context for another AI model tasked with understanding, debugging, refactoring, modifying, and evolving this codebase. The CKP must be compact, comprehensive, and optimized for AI consumption.

**[CRITICAL IMPLEMENTATION SEQUENCE]:**
You are an AI agent tasked with documenting this codebase. Your process MUST follow this sequence precisely:
1.  **Initial Full Codebase Analysis:** Perform a conceptual scan of the entire codebase as per the 'Crawling Instructions' below. This initial analysis is crucial for understanding the overall structure and interdependencies. This involves conceptually reading and understanding the relevant files before any documentation is written.
2.  **Identify and List Major Architectural Components:** Based on your initial full codebase analysis (from step 1), identify and list the major architectural components you will be documenting separately. This output corresponds to 'Part 1'. *Do not generate any markdown documents before this step is complete and the list is presented.*
3.  **Generate Overview Document:** After identifying components and based on your initial full codebase analysis, generate the `CKP_Overview.md` as described in 'Part 2'.
4.  **Generate Component-Specific Documents (Iterative Process):** For *each* major architectural component identified in step 2, you will perform the following sub-steps sequentially:
    a.  **Focused Component Analysis:** Before writing the document for a specific component, perform a detailed conceptual crawl and read of the files, directories, and code specifically related to *that component*. This ensures the component documentation is based on a deep understanding of its specific context, code, and relevant files.
    b.  **Generate Component Document:** Only after completing the focused analysis for the current component (step 4a), generate the `CKP_Component_[ComponentName].md` for that component as detailed in 'Part 3'.
    Repeat steps 4a and 4b for all identified components.

**Crawling Instructions (Simulated - this part describes what the AI *should do* conceptually during its analysis phases):**
* Assume you have the capability to recursively scan all files and directories within the codebase.
* Prioritize source code files (e.g., `.py`, `.js`, `.java`, `.ts`, `.cs`, `.go`, `.rb`, `.php`, etc.) but also consider configuration files (e.g., `json`, `yaml`, `xml`, `Dockerfile`, `docker-compose.yml`), build scripts (e.g., `Makefile`, `package.json` scripts, `pom.xml`), and important documentation files (e.g., existing `README.md`, `CONTRIBUTING.md`, API docs).
* Pay attention to file names, directory structures, import statements, class/function definitions, comments, and type annotations to identify distinct architectural components (e.g., microservices, distinct layers like frontend/backend/API, major modules with clear boundaries) and to gather details for documentation.

**Output Structure:**

**Part 1: Identification of Major Architectural Components**
* Following your 'Initial Full Codebase Analysis' (Sequence Step 1), list the major architectural components you have identified. This will determine the `CKP_Component_[ComponentName].md` files to be created. Example:
    * "Identified Major Architectural Components:
        1.  UserAuthenticationService
        2.  ProductCatalogService
        3.  OrderProcessingEngine
        4.  FrontendWebApp"
* If the codebase is small or monolithic and does not lend itself to clear component separation, state this and indicate that most details will be in a single comprehensive document following the overview. In this case, you might only produce `CKP_Overview.md` (acting as the main detailed document) or one `CKP_Component_Application.md`. Use your best judgment to determine if distinct components exist based on your analysis.

---

**Part 2: Overview Document (`CKP_Overview.md`)**

This document provides a high-level view of the entire project and references the component-specific documents. It is generated *after* the Initial Full Codebase Analysis and Component Identification.

* **1. Project Overview (Global):**
    * **Project Name:** (If identifiable, otherwise use the root directory name)
    * **Primary Goal/Purpose:** A concise (1-2 sentence) summary of what the software does or aims to achieve.
    * **Core Technologies (Global):**
        * Main Programming Language(s) & Versions used across the project.
        * Major Frameworks/Runtimes prevalent globally.
        * Key Libraries/Dependencies with project-wide significance.
    * **Project Status (Overall):**
        * Is it actively maintained?
        * Overall signs of WIP or major refactoring across components.
        * Known major issues or limitations affecting the whole system (if found).

* **2. High-Level Architecture (Global):**
    * **Architectural Pattern(s):** (e.g., Monolithic, Microservices, MVC, MVVM, Layered Architecture, Event-Driven). Describe the dominant pattern(s) for the entire system.
    * **Major Architectural Components (Summary & Links):**
        * List each major component identified in "Part 1".
        * For each component:
            * **Name:** (e.g., User Authentication Service)
            * **Brief Responsibility (1 sentence):**
            * **Reference:** "See `CKP_Component_UserAuthenticationService.md` for details."
    * **Overall Data Flow:** Briefly describe how data generally flows between the major components and any shared data stores.
    * **System-Wide Entry Points:** How is the overall application/system initiated or accessed at a high level? (e.g., main application entry, API gateway).

* **3. Build, Test, and Deployment (Global):**
    * **Overall Build Process:** How is the entire project or multiple components built together (if applicable)?
    * **Overall Testing Strategy:** Project-wide testing approaches, shared testing infrastructure, or E2E testing strategies.
    * **Overall Deployment Strategy:** How is the system as a whole deployed? Any orchestration or multi-component deployment considerations.

* **4. Cross-Cutting Concerns (Global):**
    * **Configuration Management:** How is application configuration handled at a global level or shared across components?
    * **Error Handling & Logging Conventions (Global):** Any project-wide standards or shared libraries for these.
    * **Coding Style/Conventions (Global):** Project-wide linting, formatting, or naming conventions.
    * **Shared Libraries/Modules:** Any internal libraries or modules used by multiple major components.
    * **Security Considerations (Global):** Overarching security principles or mechanisms applied across the system.

---

**Part 3: Component-Specific Documents (`CKP_Component_[ComponentName].md`)**

Generate one such Markdown file for EACH major architectural component identified in "Part 1". Replace `[ComponentName]` with the actual name of the component (e.g., `CKP_Component_UserAuthenticationService.md`).

**[Component Documentation Process Note]: As outlined in the 'CRITICAL IMPLEMENTATION SEQUENCE' (Step 4), before generating the documentation for each component below, ensure you have first performed a 'Focused Component Analysis' (conceptual read/analysis) of the files and code specifically relevant to *that individual component*. Only then, proceed to write its documentation.**

* **A. Component Overview:**
    * **Component Name:** (e.g., User Authentication Service)
    * **Detailed Purpose & Responsibilities:** What does this component do in detail? What problems does it solve?
    * **Technologies Specific to this Component:** List any languages, frameworks, or key libraries that are primarily used within this component and differ from or are an extension of the global ones.
    * **Key Interactions:** How does this component interact with other *major* components listed in `CKP_Overview.md`? (e.g., "Consumes data from ProductCatalogService via its REST API", "Publishes events to OrderProcessingEngine via Kafka topic X").

* **B. Detailed Code Structure & Conventions (within this component):**
    * **Directory Structure:** Explain the organization of this component's codebase.
    * **Core Classes & Functions:** List the most important classes and functions *within this component*. For each:
        * Name & Signature:
        * Purpose:
        * Key Inputs/Outputs:
        * Internal Dependencies (within this component):
        * Statefulness:
    * **API Endpoints (Exposed by this component):**
        * HTTP Method & Path:
        * Brief Description:
        * Expected Request/Response Payloads (key fields):
        * Authentication/Authorization specifics for these endpoints.
    * **Internal Configuration:** How is this specific component configured (if different from global)?
    * **Error Handling & Logging (Specific to this component):** Patterns and mechanisms used locally.

* **C. Data Models (Managed or primarily used by this component):**
    * For each major data entity primarily owned or managed by this component:
        * Entity Name:
        * Key Attributes/Fields:
        * Relationships (especially to data within this component or its direct dependencies):
        * Storage (if specific to this component, e.g., its own database schema).

* **D. Key Algorithms & Business Logic (within this component):**
    * Identify and describe any complex algorithms or core business logic specific to this component.
    * Explain purpose and high-level workings.
    * Note performance-sensitive areas.

* **E. Dependencies & Integrations (of this component):**
    * **Internal Dependencies (to other major components):** Briefly describe data contracts or APIs consumed from other components.
    * **External Service Integrations:** List external services this component directly interacts with (e.g., a specific database, a third-party API it calls).
        * Service Name:
        * Purpose of Integration:
        * How it's integrated:

* **F. Component-Specific Build, Test, and Deployment:**
    * Build Process for this component (if it has its own distinct build steps).
    * Testing Strategy specific to this component (unit, integration tests, specific frameworks). How to run its tests.
    * Deployment details for this component (e.g., as a separate container, serverless function).

* **G. Current State & "Gotchas" (for this component):**
    * **Code Quality Assessment:** Overall quality of this component's code.
    * **Potential Refactoring Areas:** Obvious areas needing refactoring within this component.
    * **Known Issues/TODOs:** Significant `TODO`, `FIXME`, etc., specific to this component.
    * **Areas of High Complexity:** Parts of this component that are particularly complex.
    * **Implicit Assumptions/Conventions:** Unstated rules or conventions relevant when working *within this component*.

---

**General Output Format Guidance (for all documents):**
* Use Markdown for easy readability and parsing.
* Be concise but provide enough detail for an AI to understand context without needing to re-read the entire codebase for every minor task.
* Use bullet points and lists for clarity.
* Use code formatting (backticks for inline code, triple backticks for blocks) for file names, function names, and snippets.
* If you cannot find information for a specific section, explicitly state "Information not found" or "Not discernible from the provided codebase." Do not invent information.
* Prioritize accuracy. If unsure, state the uncertainty.
* Ensure filenames for component documents are clear and consistently formatted (e.g., `CKP_Component_MyComponentName.md`).

</directive>

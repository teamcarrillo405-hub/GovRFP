export interface TemplateSection {
  name: string
  guidance: string
  pageLimit?: string
  required: boolean
}

export interface ProposalTemplate {
  id: string
  name: string
  category: 'dod' | 'gsa' | 'idiq' | 'sbir' | 'construction' | 'it'
  contractType: string
  typicalAgencies: string[]
  description: string
  sections: TemplateSection[]
  estimatedPages: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

export const PROPOSAL_TEMPLATES: ProposalTemplate[] = [
  {
    id: 'dod-technical',
    name: 'DoD Technical Services',
    category: 'dod',
    contractType: 'Cost-Plus Fixed Fee (CPFF)',
    typicalAgencies: ['Department of Defense', 'Army', 'Navy', 'Air Force', 'DARPA'],
    description:
      'Use this template for Department of Defense solicitations requiring detailed technical proposals and cost-reimbursement pricing. Best suited for research, development, engineering support, and specialized technical services where performance risk is shared with the government.',
    estimatedPages: '40-60 pages',
    difficulty: 'advanced',
    sections: [
      {
        name: 'Cover Letter',
        guidance:
          'Introduce your company, reference the solicitation number, and state your intent to propose. Keep it concise — one page maximum. Include your cage code, DUNS/UEI, and a brief capability statement.',
        required: true,
      },
      {
        name: 'Executive Summary',
        guidance:
          'Summarize your understanding of the requirement, your technical approach, and why your team is uniquely qualified. This is the first section evaluators read — make the discriminators clear in the first paragraph.',
        pageLimit: '2 pages max',
        required: true,
      },
      {
        name: 'Technical Approach',
        guidance:
          'Describe your methodology, tools, technologies, and processes in detail. Reference specific requirements from the PWS/SOW by paragraph number. Include diagrams, workflows, and risk mitigation strategies.',
        pageLimit: '15 pages max',
        required: true,
      },
      {
        name: 'Management Plan',
        guidance:
          'Detail your organizational structure, lines of authority, and coordination processes. Describe how you will manage subcontractors, handle scope changes, and maintain communication with the Contracting Officer and COR.',
        pageLimit: '10 pages max',
        required: true,
      },
      {
        name: 'Staffing Plan',
        guidance:
          'Identify key personnel with resumes, and describe your strategy for recruiting, retaining, and replacing staff. Include labor category mix and explain how staffing levels align with the performance schedule.',
        pageLimit: '8 pages max',
        required: true,
      },
      {
        name: 'Past Performance',
        guidance:
          'Provide 5 relevant references with contract numbers, dollar values, periods of performance, and COR contact information. Select projects that closely mirror the scope, size, and complexity of this requirement.',
        pageLimit: '5 references',
        required: true,
      },
      {
        name: 'Quality Control Plan',
        guidance:
          'Define your QC processes, inspection checkpoints, and corrective action procedures. Reference applicable ISO or CMMI standards if certified. Show how quality is built in — not inspected in.',
        required: true,
      },
      {
        name: 'Safety Plan',
        guidance:
          'Outline your OSHA compliance program, incident reporting procedures, and site-specific safety protocols. DoD evaluators pay close attention to EMR rates — include yours and provide context if above industry average.',
        required: true,
      },
      {
        name: 'Project Schedule',
        guidance:
          'Provide a milestone-level schedule showing key deliverables, review gates, and critical path. A simple Gantt chart is acceptable for CPFF contracts; earned value management (EVM) integration may be required for larger efforts.',
        required: true,
      },
    ],
  },
  {
    id: 'gsa-services',
    name: 'GSA Professional Services',
    category: 'gsa',
    contractType: 'Firm Fixed Price (FFP)',
    typicalAgencies: ['GSA', 'General Services Administration', 'Federal agencies via GSA Schedule'],
    description:
      'Designed for GSA Schedule task orders and open-market FFP professional services solicitations. This template is suitable for consulting, IT services, training, and administrative support across all federal civilian agencies.',
    estimatedPages: '25-40 pages',
    difficulty: 'intermediate',
    sections: [
      {
        name: 'Cover Letter',
        guidance:
          'Reference your GSA Schedule number and SIN(s) if applicable. Confirm compliance with all RFQ terms and your ability to meet the required delivery schedule. One page maximum.',
        required: true,
      },
      {
        name: 'Executive Summary',
        guidance:
          'Lead with your value proposition and key differentiators. Summarize your approach, relevant experience, and team qualifications in two pages or less. GSA evaluators often use this section as the tie-breaker.',
        pageLimit: '2 pages max',
        required: true,
      },
      {
        name: 'Technical Approach',
        guidance:
          'Describe your methodology and tools. For GSA Schedule task orders, map your approach directly to each SOO/SOW objective. Be specific about deliverables, formats, and acceptance criteria.',
        required: true,
      },
      {
        name: 'Management Plan',
        guidance:
          'Identify your project manager and describe your team structure. Explain your quality assurance, communication, and reporting cadence. Federal clients value predictability — emphasize consistent status reporting.',
        required: true,
      },
      {
        name: 'Past Performance',
        guidance:
          'Provide 3 recent, relevant contracts completed within the past 5 years. Include agency name, contract number, scope description, dollar value, and POC contact information with current phone and email.',
        pageLimit: '3 references',
        required: true,
      },
      {
        name: 'Key Personnel',
        guidance:
          'Include abbreviated resumes (2 pages max each) for all key personnel named in the RFQ. Highlight specific experience relevant to the task order requirements and security clearance levels held.',
        required: true,
      },
      {
        name: 'Price / Rate Schedule',
        guidance:
          'Provide fully loaded labor rates by category and level. For GSA Schedule responses, reference your approved pricelist. Ensure all rates are consistent with your Schedule contract and any applicable price reductions.',
        required: true,
      },
    ],
  },
  {
    id: 'idiq-task-order',
    name: 'IDIQ Task Order',
    category: 'idiq',
    contractType: 'Time & Materials (T&M) or FFP',
    typicalAgencies: ['Any agency with an IDIQ vehicle', 'DHS', 'HHS', 'VA'],
    description:
      'Use this template when responding to task order requests (TORs) under an existing IDIQ, MAC, or BPA vehicle. The condensed format is appropriate for competition among pre-qualified holders where detailed technical volumes are often constrained.',
    estimatedPages: '20-35 pages',
    difficulty: 'intermediate',
    sections: [
      {
        name: 'Executive Summary',
        guidance:
          'Open with a clear statement of your understanding, your approach, and your team. Under IDIQ competitions, evaluators are comparing pre-qualified firms — lead with what makes your approach superior.',
        pageLimit: '2 pages max',
        required: true,
      },
      {
        name: 'Technical Approach',
        guidance:
          'Address the task order PWS paragraph by paragraph. Propose specific solutions, tools, and personnel. IDIQ TOR evaluations are often best-value — go beyond compliance to show innovation and efficiency.',
        required: true,
      },
      {
        name: 'Management Plan',
        guidance:
          'Describe your team organization and how you will manage the task order alongside other work. Address surge capacity, since IDIQ vehicles often have variable ordering patterns and rapid task order turn-around requirements.',
        required: true,
      },
      {
        name: 'Past Performance',
        guidance:
          'Provide 5 references from similar task orders, ideally on the same or a related IDIQ vehicle. Emphasize on-time delivery, cost control within ceiling, and customer satisfaction scores.',
        pageLimit: '5 references',
        required: true,
      },
      {
        name: 'Key Personnel',
        guidance:
          'IDIQ task orders frequently have named personnel requirements. Confirm availability of each key person and include a current resume. Address any conflicts with other active task orders on the same vehicle.',
        required: true,
      },
      {
        name: 'Price Matrix',
        guidance:
          'Complete the government-provided pricing spreadsheet precisely as formatted. For T&M orders, include labor categories, rates, and estimated hours. For FFP, provide a summary price by CLIN with a brief basis of estimate.',
        required: true,
      },
      {
        name: 'Transition Plan',
        guidance:
          'Describe your approach to assuming responsibility from the incumbent, if applicable. Include a 30/60/90-day ramp-up timeline and identify transition risks with mitigation strategies.',
        required: false,
      },
    ],
  },
  {
    id: 'sbir-phase-i',
    name: 'SBIR Phase I',
    category: 'sbir',
    contractType: 'Fixed Price (Research)',
    typicalAgencies: ['NSF', 'NIH', 'DOE', 'DoD SBIR offices', 'NASA'],
    description:
      'Template for Small Business Innovation Research Phase I proposals. Phase I awards fund feasibility studies (typically $50K-$275K for 6-12 months) to demonstrate scientific/technical merit and commercial potential of an innovative concept.',
    estimatedPages: '30-45 pages',
    difficulty: 'advanced',
    sections: [
      {
        name: 'Cover Page',
        guidance:
          'Complete the agency-specific cover page form in full. Include the topic number, proposal title, company information, and certifications. The cover page is not part of the page count but must be error-free.',
        required: true,
      },
      {
        name: 'Abstract',
        guidance:
          'Write a 200-300 word summary that can stand alone. Clearly state the problem, your innovation, the Phase I technical objectives, and the commercial application. Abstracts for funded proposals are often made public.',
        pageLimit: '1 page max',
        required: true,
      },
      {
        name: 'Identification & Significance',
        guidance:
          'Define the problem and explain why current solutions are inadequate. Cite peer-reviewed literature to establish the significance of the problem. Show that your approach is novel relative to the state of the art.',
        required: true,
      },
      {
        name: 'Phase I Technical Objectives',
        guidance:
          'List 3-5 specific, measurable technical objectives for Phase I. Each objective should be a hypothesis to be tested or a capability to be demonstrated. Avoid vague objectives like "assess feasibility" without defining success criteria.',
        required: true,
      },
      {
        name: 'Phase I Work Plan',
        guidance:
          'For each objective, describe the tasks, methods, experiments, and analyses. Include a timeline table with milestones and deliverables. Identify potential failure points and alternative approaches.',
        required: true,
      },
      {
        name: 'Related R&D',
        guidance:
          'Disclose any related research by your company or PI, including prior SBIR/STTR awards. Explain how Phase I builds on prior work without merely duplicating it. Reviewers use this to assess team competence and avoid duplication.',
        required: true,
      },
      {
        name: 'Relationship with Future R&D',
        guidance:
          'Describe how Phase I success leads to a Phase II effort. Outline what Phase II would accomplish and estimated budget range. Many agencies want evidence of a path to Phase III commercialization before funding Phase I.',
        required: true,
      },
      {
        name: 'Commercial Applications & Other Benefits',
        guidance:
          'Identify the primary market, customer segments, and revenue model. Provide market size data with credible sources. SBIR reviewers score commercial potential heavily — show that you have spoken with potential customers.',
        required: true,
      },
      {
        name: 'Key Personnel',
        guidance:
          'Include abbreviated CVs (2 pages max) for the PI and all senior personnel. The PI must commit at least 51% of their time to the company and the proposed effort. Highlight directly relevant technical and business experience.',
        required: true,
      },
      {
        name: 'References',
        guidance:
          'Cite all technical literature referenced in the proposal. Use a consistent citation format (APA, ACS, etc.). References are typically not counted in the page limit — confirm the specific agency solicitation for rules.',
        required: true,
      },
    ],
  },
  {
    id: 'construction-ifb',
    name: 'Construction IFB',
    category: 'construction',
    contractType: 'Firm Fixed Price (FFP) Construction',
    typicalAgencies: ['Army Corps of Engineers', 'NAVFAC', 'VA', 'GSA PBS', 'USACE'],
    description:
      'Template for federal construction Invitation for Bids (IFB) and best-value construction RFPs. Used for new construction, renovation, and repair projects under FAR Part 36. Price is typically the primary award factor on sealed-bid IFBs.',
    estimatedPages: '30-50 pages',
    difficulty: 'intermediate',
    sections: [
      {
        name: 'Cover Sheet',
        guidance:
          'Complete the SF-1442 or agency-specific cover form. Verify your SAM.gov registration is active, bonding capacity is sufficient, and all required certifications (8(a), HUBZone, SDVOSB, etc.) are listed accurately.',
        required: true,
      },
      {
        name: 'Contractor Qualifications',
        guidance:
          'Summarize your company history, licenses (verify state-specific requirements), bonding capacity, and annual revenue. For best-value RFPs, include relevant certifications such as ISO 9001 or AGC membership.',
        required: true,
      },
      {
        name: 'Similar Projects',
        guidance:
          'List 5 recently completed projects of similar scope, type, and dollar value. Include project name, owner, architect, contract value, completion date, and owner POC. Photos are a strong addition for best-value proposals.',
        pageLimit: '5 references',
        required: true,
      },
      {
        name: 'Key Personnel',
        guidance:
          'Provide resumes for the Project Superintendent, Project Manager, and Safety Officer at minimum. Confirm each person has the required certifications (OSHA 30, EM 385-1-1, etc.) and is available for this project.',
        required: true,
      },
      {
        name: 'Equipment List',
        guidance:
          'List major equipment to be used on the project, indicating owned vs. rented. For heavy civil or specialty work, demonstrate that you have or can acquire the necessary equipment without schedule risk.',
        required: false,
      },
      {
        name: 'Safety Plan',
        guidance:
          'Provide your Accident Prevention Plan (APP) outline or full APP if required by the solicitation. Include your 3-year EMR rate. USACE and NAVFAC routinely evaluate safety past performance as a proposal factor.',
        required: true,
      },
      {
        name: 'Quality Control Plan',
        guidance:
          'Describe your Three-Phase Inspection System as required under RMS (Resident Management System). Identify your QC Manager (must be independent of the superintendent) and describe preparatory, initial, and follow-up phase procedures.',
        required: true,
      },
      {
        name: 'Project Schedule (CPM)',
        guidance:
          'Submit a Critical Path Method schedule showing all major activities, durations, and the critical path. For projects over $2M, Primavera P6 or MS Project is typically required. Show that you can meet the contract completion date.',
        required: true,
      },
      {
        name: 'Bonding & Insurance',
        guidance:
          'Confirm 100% performance and payment bond capability (Miller Act threshold). List your surety company and their AM Best rating. Include a letter from your bonding agent confirming bond capacity for the project amount.',
        required: true,
      },
      {
        name: 'Price Proposal (Schedule of Values)',
        guidance:
          'Complete the government-provided bid schedule or Schedule of Values exactly as formatted. Verify all alternates are priced. Round-number bids draw scrutiny — your SOV should reflect actual cost buildups.',
        required: true,
      },
    ],
  },
  {
    id: 'it-cybersecurity',
    name: 'IT Systems & Cybersecurity',
    category: 'it',
    contractType: 'FFP or T&M',
    typicalAgencies: ['CISA', 'DHS', 'DoD', 'HHS', 'Treasury', 'GSA'],
    description:
      'Template for federal IT systems integration, software development, and cybersecurity services proposals. Covers FedRAMP, NIST 800-171/800-53 compliance, cloud migration, and zero-trust architecture engagements across civilian and defense agencies.',
    estimatedPages: '35-55 pages',
    difficulty: 'advanced',
    sections: [
      {
        name: 'Executive Summary',
        guidance:
          'Open with your understanding of the agency\'s mission and how your solution directly enables it. Quantify outcomes where possible (e.g., reduced incident response time by X%, achieved ATO in Y months). Two pages maximum.',
        pageLimit: '2 pages max',
        required: true,
      },
      {
        name: 'Technical Approach',
        guidance:
          'Describe your architecture, development methodology (Agile/DevSecOps), and technology stack. Reference specific RFP requirements. Include a system architecture diagram and explain how your approach reduces technical debt and vendor lock-in.',
        required: true,
      },
      {
        name: 'Security Plan (NIST 800-171 Compliance)',
        guidance:
          'Detail your approach to the 110 NIST SP 800-171 controls (for DoD/CUI environments) or NIST SP 800-53 for civilian agencies. Describe your Plan of Actions & Milestones (POA&M) process and your path to ATO/FedRAMP authorization.',
        required: true,
      },
      {
        name: 'Systems Architecture',
        guidance:
          'Provide a current-state, transition-state, and end-state architecture diagram. Describe your approach to cloud (FedRAMP-authorized services only), on-premise integration, and zero-trust network access (ZTNA) implementation.',
        required: true,
      },
      {
        name: 'Management Plan',
        guidance:
          'Describe your Agile team structure (scrums, sprints, velocity), project management tooling (Jira, Azure DevOps), and reporting cadence. Identify how you will manage the government product owner relationship and sprint review process.',
        required: true,
      },
      {
        name: 'Staffing & Key Personnel',
        guidance:
          'Include resumes for the Program Manager, Lead Architect, and ISSO/Security lead at minimum. Confirm clearance levels held. Address your bench depth for surge and your subcontractor teaming arrangements.',
        required: true,
      },
      {
        name: 'Past Performance',
        guidance:
          'Provide references for similar federal IT/cybersecurity contracts. Highlight ATO achievements, FedRAMP authorizations, security assessment results, and on-time delivery of major releases. Include CPARS ratings if available.',
        required: true,
      },
      {
        name: 'Quality Assurance Plan',
        guidance:
          'Describe your CI/CD pipeline, automated testing strategy, code coverage targets, and peer review process. Reference NIST SP 800-218 (SSDF) for software supply chain security practices where applicable.',
        required: true,
      },
      {
        name: 'Data Rights & IP',
        guidance:
          'Clearly state which deliverables will be provided with unlimited rights vs. restricted rights per DFARS/FAR data rights clauses. Identify any commercial off-the-shelf (COTS) components and their license terms.',
        required: true,
      },
      {
        name: 'Price Narrative',
        guidance:
          'Provide a basis of estimate (BOE) for each labor category, including hours and rate derivation. For T&M CLINs, reference your approved labor rates. Justify any ODCs and ensure travel is within GSA per diem rates.',
        required: true,
      },
    ],
  },
]

export function getTemplate(id: string): ProposalTemplate | undefined {
  return PROPOSAL_TEMPLATES.find((t) => t.id === id)
}

// Defines the instructions that the Antigravity Browser Subagent will follow
// when triggered by the /api/audit/trigger endpoint

export const BROWSER_AGENT_PROMPT = `
You are the Antigravity Browser Subagent for KarmaPulse.
Your objective is to act as the "SLA Guardian" and audit active jobs in the NextGear Dash CRM.

1. Navigate to 'dash.nextgear.com' (Assumption: user is logged in or you will log in using provided credentials).
2. Locate the "Job Activity" and "Photo Gallery" for the specified Job ID.
3. SCRAPE the following:
   - "Job Created Date/Time"
   - "First Contact Log Date/Time"
   - "On-Site Arrival Log Date/Time"
   - Confirm if "Source of Loss" photo exists in the Gallery.
4. Calculate the time spans between these events based on the SLA Rules (e.g. Contact Time must be < 15 mins).
5. If a photo is missing and the job is approaching a deadline (e.g. On-Site limit is 4h, currently at 3h30m), output a "Karma Command":
   - Severity: Heavy
   - Solution: "Tech must upload Source of Loss photo immediately."
   - VaAction: "Call the tech to remind them of the required photo before leaving the site."
6. Return a structured JSON response containing the extracted data and the evaluated SLA Status.
`;

export interface ScrapedJobData {
    jobId: string;
    contactTimeElapsedMins: number;
    onSiteTimeElapsedMins: number;
    hasSourceOfLossPhoto: boolean;
    hasMoistureLog: boolean;
}

export function evaluateSLA(data: ScrapedJobData, slaRules: any[]): any {
    // Logic to cross-reference ScrapedJobData against the DB SLA Rules
    // Returns Status: Weightless, Neutral, Heavy, or Breached
    let status = 'Weightless';
    let nextAction = 'None';
    let timeToBreach = 0;

    // Implementation will vary based on rules, this is the foundational shell
    return { status, nextAction, timeToBreach };
}

import { pswTutorScenario } from './pswTutorAgent'; // Add this import
// import { simpleHandoffScenario } from './simpleHandoff';
// import { customerServiceRetailScenario } from './customerServiceRetail';
// import { chatSupervisorScenario } from './chatSupervisor';

import type { RealtimeAgent } from '@openai/agents/realtime';

// Map of scenario key -> array of RealtimeAgent objects
export const allAgentSets: Record<string, RealtimeAgent[]> = {
  pswTutor: pswTutorScenario, // CHANGED: Key is "pswTutor"
  EarlyChildhoodTutor: pswTutorScenario, // Add this line
  // simpleHandoff: simpleHandoffScenario,
  // customerServiceRetail: customerServiceRetailScenario,
  // chatSupervisor: chatSupervisorScenario,
};

// export const defaultAgentSetKey = 'chatSupervisor';
export const defaultAgentSetKey = "pswTutor"; // This should match the key

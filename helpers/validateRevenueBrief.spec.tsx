import { validateRevenueBrief } from "./validateRevenueBrief";
describe("Revenue brief validation", () => {
  const action = {action:"Inspect refunds",rationale:"Validate the recent increase.",confidence:"Medium"};
  const valid = {whatChanged:"Refunds rose.",investigation:"Check causes before acting.",whatNext:"Collect another period.",risks:["Small sample"],opportunities:["Validate source"],actions:[action,action,action],guardrail:"Hypotheses are not causal proof."};
  it("accepts a complete brief", () => { expect(validateRevenueBrief(valid).actions.length).toBe(3); });
  it("rejects missing narratives, actions and invented confidence defaults", () => {
    for(const value of [{}, {...valid,whatChanged:""}, {...valid,actions:[]}, {...valid,actions:[{...action,confidence:"Certain"},action,action]}]) expect(() => validateRevenueBrief(value)).toThrow();
  });
});
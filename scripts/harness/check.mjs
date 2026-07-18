import { checkArchitecture } from './check-architecture.mjs';
import { checkCodeShape } from './check-code-shape.mjs';
import { checkKnowledge } from './check-knowledge.mjs';
import { printResult } from './lib.mjs';

const issues = [...checkArchitecture(), ...checkKnowledge(), ...checkCodeShape()];
printResult(issues);

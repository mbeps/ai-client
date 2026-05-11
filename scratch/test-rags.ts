import { listKnowledgebases } from "../lib/actions/knowledgebases/list-knowledgebases";
listKnowledgebases().then(console.log).catch(console.error);

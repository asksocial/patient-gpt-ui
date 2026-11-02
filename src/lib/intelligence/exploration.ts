import { sourcePassages } from "../../answering/evidence/sourcePassages";
import { loadCurrentGlp1ExecutiveIntelligence } from "../answers/loadCurrentGlp1ExecutiveIntelligence";
import { loadCanonicalFindingsForAsk, getCanonicalCorpusRevision } from "../answers/loadCanonicalFindingsForAsk";
export function explorationFindingId(finding: {findingId?: string;id?: string;sourceId?: string}) {return String(finding.findingId || finding.id || finding.sourceId || "");}
export function explorationSummary(area: string) {
 const current=loadCurrentGlp1ExecutiveIntelligence(area);
 if(!current) throw Object.assign(new Error("Current-corpus exploration is available for the GLP-1 pilot only."),{status:422});
 const snapshot=current.knowledgeSnapshot;
 return { ...current, corpusRevision:getCanonicalCorpusRevision(area), scope:{kind:"full_corpus",description:"Current GLP-1 corpus. Search questions, countries and module filters do not restrict this view.",sourceRecordCount:current.executiveIntelligence.dataQuality.sourceRecordCount,analyzedFindingCount:snapshot.datasetFindingCount,excludedRecordCount:current.executiveIntelligence.dataQuality.excludedRecordCount,sourceQuery:snapshot.sourceQuery,snapshotKey:snapshot.snapshotKey,generatedAt:snapshot.createdAt,themeDenominators:current.themeSummary.map(t=>({themeId:t.themeId,count:t.count,denominator:t.prevalence?.eligibleFindingCount,percent:t.prevalence?.eligiblePercent})),limits:["Qualitative exploration and source review only; this corpus does not support comprehensive answers or population estimates.","Findings and source records are not unique people, patients or safety cases. Themes can overlap; percentages need not sum to 100%.","Source categories and channels describe metadata coverage, not independent clinical verification. Missing categories are shown as unavailable."]}};
}
export function explorationEvidence(area: string, themeId: string, query="", page=1, expectedSnapshot="") {
 const summary=explorationSummary(area);
 if(expectedSnapshot && summary.knowledgeSnapshot.snapshotKey!==expectedSnapshot)throw Object.assign(new Error("The corpus changed. Refresh the overview before reviewing its sources."),{status:409});
 const theme=summary.knowledgeSnapshot.themeRecords.find(t=>t.themeId===themeId);
 if(themeId && !theme)throw Object.assign(new Error("Theme not found in this current snapshot."),{status:404});
 const corpus=loadCanonicalFindingsForAsk(area);if(corpus.status!=="available")throw new Error(corpus.reason);
 const ids=theme?new Set(theme.findingIds):null;
 const population=corpus.findings.filter(f=>!ids||ids.has(explorationFindingId(f)));
 const items=population.map(f=>{
  const fields=f.rawMetadata?.fields||{};
  const passages=sourcePassages(f);
  const raw=f as typeof f & {country?:string|string[];platform?:string};
  const names=(value:unknown)=>Array.isArray(value)?value.filter(Boolean).join(", "):typeof value==="string"?value:"";
  return {findingId:explorationFindingId(f),text:[...new Set(passages.map(p=>p.text))].join("\n\n")||"Original source text is unavailable in this retained finding.",url:passages.find(p=>p.url)?.url||null,platform:names(f.platforms)||names(raw.platform)||names(fields['Source Name'])||"Not recorded",countries:names(f.countries)||names(raw.country)||names(fields.Country)||"Not recorded"};
 }).filter(item=>!query.trim()||`${item.text} ${item.platform} ${item.countries}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 const size=20,total=items.length,pages=Math.max(1,Math.ceil(total/size)),selectedPage=Math.min(pages,Math.max(1,Number.isFinite(page)?Math.floor(page):1));
 return {snapshotKey:summary.knowledgeSnapshot.snapshotKey,themeId:theme?.themeId||null,themeLabel:theme?.label||"All analyzed findings",populationCount:population.length,total,page:selectedPage,pages,pageSize:size,items:items.slice((selectedPage-1)*size,selectedPage*size)};
}

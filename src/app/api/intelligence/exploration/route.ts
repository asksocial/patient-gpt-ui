import { NextRequest,NextResponse } from "next/server";
import { getCurrentEntitlements } from "../../../../lib/entitlements/server";
import { hasTherapeuticAreaAccess } from "../../../../lib/therapeuticAccess/server";
import { explorationSummary,explorationEvidence } from "../../../../lib/intelligence/exploration";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function GET(request:NextRequest){try{
 const entitlements=await getCurrentEntitlements();if(!entitlements)return NextResponse.json({ok:false,error:"Unauthorized"},{status:401,headers});
 const p=request.nextUrl.searchParams,kind=p.get("kind"),area=p.get("therapeuticArea")||"";
 if(!["graph","executive"].includes(kind||""))return NextResponse.json({ok:false,error:"A supported exploration kind is required."},{status:400,headers});
 const capability=kind==="graph"?"knowledge_intelligence":"executive_intelligence";
 if(!entitlements.capabilities[capability]?.granted&&!entitlements.isAdmin)return NextResponse.json({ok:false,error:"Exploration access is required."},{status:403,headers});
 if(!await hasTherapeuticAreaAccess(entitlements.userId,area,entitlements.isAdmin))return NextResponse.json({ok:false,error:"Topic access is required."},{status:403,headers});
 if(p.get("format")==="json"){
  if(!entitlements.capabilities.exports?.granted&&!entitlements.isAdmin)return NextResponse.json({ok:false,error:"Export access is required."},{status:403,headers});
  const summary=explorationSummary(area);
  if(p.get("snapshotKey")&&p.get("snapshotKey")!==summary.knowledgeSnapshot.snapshotKey)return NextResponse.json({ok:false,error:"The corpus changed. Refresh the brief before exporting."},{status:409,headers});
  return new NextResponse(JSON.stringify({type:"qualitative_exploration_export",scope:summary.scope,corpusRevision:summary.corpusRevision,brief:summary.executiveIntelligence,snapshot:summary.knowledgeSnapshot},null,2),{headers:{...headers,"Content-Type":"application/json","Content-Disposition":'attachment; filename="asksocial-glp1-'+kind+'-brief.json"'}});
 }
 if(p.get("view")==="evidence")return NextResponse.json({ok:true,evidence:explorationEvidence(area,p.get("themeId")||"",p.get("q")||"",Number(p.get("page")||1),p.get("snapshotKey")||"")},{headers});
 return NextResponse.json({ok:true,...explorationSummary(area),exportAllowed:!!entitlements.capabilities.exports?.granted||entitlements.isAdmin},{headers});
 }catch(error){const e=error as Error&{status?:number};return NextResponse.json({ok:false,error:e.message||"Exploration could not be loaded."},{status:e.status||500,headers});}}

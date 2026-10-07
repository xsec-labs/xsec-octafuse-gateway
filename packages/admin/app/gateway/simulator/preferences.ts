import { isInvokeKind, parseGatewayToolId, type InvokeKind, type GatewayToolId } from '@/lib/invoke-kind';
import type { SimulatorProtocol } from '@/lib/simulator/endpoint';
import { LS_PROXY,LS_PROTOCOL,LS_MODEL_ID,LS_ROUTE_GROUP,LS_KEY_ID,LS_INVOKE_KIND,LS_TOOL_ID } from './simulator-utils';

export const SIMULATOR_SETTINGS_KEY='octafuse.simulator.settings.v1';
export type SimulatorSettings={version:1;proxyBaseUrl:string;protocol:SimulatorProtocol;modelId:string;routeGroup:string;keyId:string;invokeKind:InvokeKind;toolId:GatewayToolId};
export const DEFAULT_SIMULATOR_SETTINGS:SimulatorSettings={version:1,proxyBaseUrl:'',protocol:'openai',modelId:'',routeGroup:'',keyId:'',invokeKind:'llm',toolId:'web-search'};
function invalid():never{throw new Error('INVALID_SIMULATOR_SETTINGS');}
export function parseSimulatorSettings(value: unknown):SimulatorSettings {
 if(!value||typeof value!=='object'||Array.isArray(value))invalid();
 const row=value as Record<string,unknown>;
 if(row.version!==1||!['openai','anthropic','gemini'].includes(String(row.protocol))||typeof row.invokeKind!=='string'||!isInvokeKind(row.invokeKind)||typeof row.toolId!=='string'||!parseGatewayToolId(row.toolId))invalid();
 const toolId=parseGatewayToolId(row.toolId as string);
 if(!toolId)invalid();
 for(const name of ['proxyBaseUrl','modelId','routeGroup','keyId'])if(typeof row[name]!=='string')invalid();
 return {version:1,proxyBaseUrl:row.proxyBaseUrl as string,protocol:row.protocol as SimulatorProtocol,modelId:row.modelId as string,routeGroup:row.routeGroup as string,keyId:row.keyId as string,invokeKind:row.invokeKind,toolId};
}
/** The seven legacy records remain intact for a code rollback. Missing records use declared defaults. */
export function readSimulatorSettings(storage:Storage):SimulatorSettings {
 const current=storage.getItem(SIMULATOR_SETTINGS_KEY);
 if(current!==null)return parseSimulatorSettings(JSON.parse(current));
 return parseSimulatorSettings({version:1,
  proxyBaseUrl:storage.getItem(LS_PROXY)??'',protocol:storage.getItem(LS_PROTOCOL)??'openai',modelId:storage.getItem(LS_MODEL_ID)??'',routeGroup:storage.getItem(LS_ROUTE_GROUP)??'',keyId:storage.getItem(LS_KEY_ID)??'',invokeKind:storage.getItem(LS_INVOKE_KIND)??'llm',toolId:storage.getItem(LS_TOOL_ID)??'web-search',
 });
}
export function saveSimulatorSettings(storage:Storage,settings:SimulatorSettings):void {
 storage.setItem(SIMULATOR_SETTINGS_KEY,JSON.stringify(parseSimulatorSettings(settings)));
}

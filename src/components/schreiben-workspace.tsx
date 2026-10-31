"use client";
import {useAccountLearningMode} from "@/components/account-learning-boundary";
import {AccountWritingEditor} from "./account-writing-editor";
import {OriginalSchreibenWorkspace} from "./account-writing-workspace-view";
export function SchreibenWorkspace({draftId}:{draftId:string}){return useAccountLearningMode()?<AccountWritingEditor draftId={draftId}/>:<OriginalSchreibenWorkspace draftId={draftId}/>;}

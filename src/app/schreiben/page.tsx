"use client";
import {useAccountLearningMode} from "@/components/account-learning-boundary";
import {AccountWritingList} from "@/components/account-writing-list";
import {OriginalWritingList} from "@/components/account-writing-list-view";
export default function SchreibenPage(){return useAccountLearningMode()?<AccountWritingList/>:<OriginalWritingList/>;}

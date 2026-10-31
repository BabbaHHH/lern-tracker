"use client";
import {useAccountLearningMode} from "@/components/account-learning-boundary";
import {AccountWritingEditor} from "@/components/account-writing-editor";
import {OriginalNotepad} from "@/components/account-writing-notepad-view";
export default function NotizblockPage(){return useAccountLearningMode()?<AccountWritingEditor/>:<OriginalNotepad/>;}

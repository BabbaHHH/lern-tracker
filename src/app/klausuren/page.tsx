"use client";
import { useAccountLearningMode } from "@/components/account-learning-boundary";
import { AccountKlausurenPage } from "@/components/account-klausuren-page";
import { KlausurenView } from "@/components/klausuren-view";

export default function KlausurenPage() {
  const accountMode = useAccountLearningMode();
  return accountMode ? <AccountKlausurenPage /> : <KlausurenView />;
}

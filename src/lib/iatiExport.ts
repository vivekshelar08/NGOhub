import { ProjectProposal } from "@/lib/projects";

/** Minimal IATI Activity XML for donor transparency (simplified Svitech HR export). */
export function generateIatiActivityXml(project: ProjectProposal, orgName: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const budgetTotal =
    project.totalEvaluation ??
    project.budget?.reduce(
      (sum, cat) => sum + cat.items.reduce((s, i) => s + i.quantity * i.duration * i.amount, 0),
      0
    ) ??
    0;

  const outcomes =
    project.theoryOfChange?.outcomes?.map((o) => `    <result type="2"><title><narrative>${esc(o)}</narrative></title></result>`).join("\n") ??
    "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<iati-activities version="2.03" generated-datetime="${new Date().toISOString()}">
  <iati-activity default-currency="INR" last-updated-datetime="${project.updatedAt}">
    <iati-identifier>NGO-HUB-${esc(project.id)}</iati-identifier>
    <reporting-org ref="NGO-HUB" type="22">
      <narrative>${esc(orgName)}</narrative>
    </reporting-org>
    <title><narrative>${esc(project.title)}</narrative></title>
    <description type="1"><narrative>${esc(project.executiveSummary || project.aboutUs || project.interventionNature)}</narrative></description>
    <activity-status code="2"/>
    <activity-date iso-date="${project.createdAt.slice(0, 10)}" type="1"/>
    <recipient-country code="IN"/>
    <sector code="16010" vocabulary="1"/>
    <budget type="1">
      <period-start iso-date="${project.createdAt.slice(0, 10)}"/>
      <period-end iso-date="${new Date().toISOString().slice(0, 10)}"/>
      <value currency="INR" value-date="${new Date().toISOString().slice(0, 10)}">${budgetTotal}</value>
    </budget>
    <result type="1">
      <title><narrative>Beneficiaries targeted</narrative></title>
      <indicator measure="1">
        <title><narrative>Total beneficiaries</narrative></title>
        <baseline year="${new Date().getFullYear()}" value="0"/>
        <period>
          <target value="${project.totalBeneficiaries}"/>
        </period>
      </indicator>
    </result>
${outcomes}
  </iati-activity>
</iati-activities>`;
}

export function downloadIatiXml(project: ProjectProposal, orgName: string) {
  const xml = generateIatiActivityXml(project, orgName);
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `iati-${project.title.replace(/\s+/g, "-").slice(0, 40)}.xml`;
  a.click();
  URL.revokeObjectURL(url);
}

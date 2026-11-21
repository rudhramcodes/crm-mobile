import { useState } from 'react';
import { View } from 'react-native';
import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { Button } from './Button';
import { Card } from './Card';
import { Chip } from './Chip';
import { DateField } from './DateField';
import { Input } from './Input';
import { Pressable } from './Pressable';
import { SelectField } from './SelectField';
import { Text } from './Text';
import { brandLabel } from './ClientParts';
import { useTheme } from '@/constants/theme';
import { useGetClientsQuery } from '@/services/clientApi';
import { useGetProjectsQuery } from '@/services/projectApi';
import { useGetQuotationDefaultsQuery } from '@/services/quotationApi';
import { formatCurrencyExact } from '@/utils/formatters';
import { DEFAULTABLE, GST_RATES, TEMPLATES, applyDefaults, applyProject, docBody, docForm, money, recommendedTemplate } from '@/utils/quotations';

const area = (rows) => ({ height: rows * 22 + 28, paddingTop: 14, textAlignVertical: 'top' });

// One page of the PDF: numbered header that opens/closes, with "Restore suggested text" like the web.
function PageSection({ page, title, description, onRestore, open, onToggle, children }) {
  const theme = useTheme();
  return (
    <Card className="gap-4 p-4">
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`Page ${page}, ${title}`} className="flex-row items-start gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-ink">
          <Text className="font-body-semibold text-sm text-bg">{page}</Text>
        </View>
        <View className="flex-1">
          <Text className="font-body-semibold">{title}</Text>
          <Text className="text-sm text-muted">{description}</Text>
        </View>
        {open ? <ChevronUp size={20} color={theme.muted} /> : <ChevronDown size={20} color={theme.muted} />}
      </Pressable>
      {open && (
        <>
          {!!onRestore && (
            <Pressable onPress={onRestore} accessibilityLabel={`Restore suggested text for ${title}`} className="self-start py-1">
              <Text className="font-body-medium text-sm text-accent-ink">Restore suggested text</Text>
            </Pressable>
          )}
          {children}
        </>
      )}
    </Card>
  );
}

function Summary({ label, value, strong }) {
  return (
    <View className="w-1/2 py-1.5">
      <Text className="text-xs text-muted">{label}</Text>
      <Text className={strong ? 'font-body-semibold tabular-nums' : 'tabular-nums'}>{value}</Text>
    </View>
  );
}

// The web QuotationForm on a phone: client & project dropdowns, template, dates, GST, budget/price with totals,
// then each PDF page's text and the printed recipient / issuer / bank details.
// `initial` = working-draft content (edit, identity locked) or nothing (create; server defaults fill the text).
export function QuotationForm({ initial, locked, onSubmit, submitLabel, loading, fieldError }) {
  const theme = useTheme();
  const editing = !!initial;
  // `_dirty` lists fields the user typed in, so suggested text never overwrites their own writing.
  const [f, setF] = useState(() => ({ ...docForm(initial), _dirty: [] }));
  const [openPage, setOpenPage] = useState('01');
  const [printed, setPrinted] = useState(false);
  const err = (k) => fieldError?.(k);
  const dirtyOf = (x) => new Set(x._dirty);

  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v, _dirty: x._dirty.includes(k) ? x._dirty : [...x._dirty, k] }));

  // Clients and projects as on the web (first 100 of each); projects narrowed to the chosen client.
  const clientsQ = useGetClientsQuery({ limit: 100 }, { skip: !!locked });
  const clients = clientsQ.data?.data || [];
  const projectsQ = useGetProjectsQuery({ limit: 100 }, { skip: !!locked || !f.client });
  const projects = (projectsQ.data?.data || []).filter((p) => String(p.client?._id || p.client) === String(f.client));
  const client = clients.find((c) => String(c._id) === String(f.client));
  const recommended = recommendedTemplate(client?.brand);

  const pickClient = (id) => {
    const c = clients.find((x) => String(x._id) === String(id));
    setF((x) => ({ ...x, client: id, project: '', templateId: recommendedTemplate(c?.brand) }));
  };
  const pickProject = (id) => setF((x) => applyProject({ ...x, project: id }, projects.find((p) => String(p._id) === String(id)), dirtyOf(x)));

  // Suggested text from the server for this client / project / template; only fills what the user hasn't typed.
  // currentData, not data: data still holds the previous client's defaults while the new ones load.
  const defaultsQ = useGetQuotationDefaultsQuery(
    { clientId: f.client || undefined, projectId: f.project || undefined, templateId: f.templateId },
    { skip: editing },
  );
  const defaults = defaultsQ.currentData?.data?.defaults;
  // New defaults (client / project / template changed): fill untouched fields once, during render rather than in an effect.
  const [applied, setApplied] = useState(null);
  if (defaults && defaults !== applied) {
    setApplied(defaults);
    setF((x) => applyDefaults(x, defaults, DEFAULTABLE, dirtyOf(x)));
  }
  const restore = (fields) => (defaults ? () => setF((x) => applyDefaults(x, defaults, fields, dirtyOf(x), true)) : undefined);

  const m = money({ price: f.price, taxRate: f.taxRate });
  const badDates = !!f.validUntil && !!f.issueDate && f.validUntil < f.issueDate;
  // A new quotation waits until this client's own recipient, letter and bank details are filled in,
  // so a quick tap after switching clients can't freeze (and later email) the previous client's details.
  const defaultsReady = editing || (!!defaults && defaults === applied && !defaultsQ.isFetching);
  const ready = !!f.client && !!f.issueDate && !badDates && Number(f.price || 0) >= 0 && Number(f.budget || 0) >= 0 && defaultsReady;
  const pani = f.templateId === 'panigrahna';
  const toggle = (p) => () => setOpenPage((o) => (o === p ? '' : p));
  const text = (k, label, rows, extra = {}) => (
    <Input label={label} value={f[k]} onChangeText={set(k)} multiline={rows > 1} style={rows > 1 ? area(rows) : undefined} error={err(k)} {...extra} />
  );

  return (
    <>
      {locked ? (
        <Card className="gap-1 p-4">
          <Text className="font-body-semibold">{locked.client}</Text>
          {!!locked.project && <Text className="text-sm text-muted">{locked.project}</Text>}
          <Text className="text-xs text-muted">The client and project stay fixed across revisions. Printed recipient details remain editable below.</Text>
        </Card>
      ) : (
        <>
          <SelectField
            label="Client *"
            value={f.client}
            options={clients.map((c) => ({ value: c._id, label: `${c.clientId || ''} ${c.companyName}`.trim(), hint: brandLabel(c.brand) }))}
            onChange={pickClient}
            placeholder="Select client"
            searchable
            loading={clientsQ.isLoading}
            error={err('client')}
            emptyText="No clients yet. Add one in Clients first."
          />
          <SelectField
            label="Project"
            value={f.project}
            options={projects.map((p) => ({ value: p._id, label: [p.projectCode, p.title || p._id].filter(Boolean).join(' — ') }))}
            onChange={pickProject}
            onClear={() => setF((x) => ({ ...x, project: '' }))}
            placeholder={f.client ? 'Select project (optional)' : 'Select client first'}
            disabled={!f.client}
            loading={!!f.client && projectsQ.isLoading}
            searchable={projects.length > 8}
            emptyText="This client has no projects."
          />
        </>
      )}

      <Card className="gap-3 p-4">
        <Text className="font-body-semibold">Quotation template</Text>
        <Text className="text-sm text-muted">
          {client
            ? `${client.companyName} belongs to ${client.brand === 'panigrahna' ? 'Panigrahna' : 'another venture'}. ${recommended === 'panigrahna' ? 'The wedding quotation is recommended.' : 'The standard quotation is recommended.'}`
            : editing ? 'Switching template changes how the PDF pages are laid out.' : 'Choose a client to get a recommended template. You can always change it.'}
        </Text>
        {TEMPLATES.map((t) => {
          const active = f.templateId === t.value;
          return (
            <Pressable
              key={t.value}
              onPress={() => set('templateId')(t.value)}
              accessibilityLabel={`${t.label} template`}
              accessibilityState={{ selected: active }}
              className={`flex-row items-center gap-3 rounded-2xl border-[1.5px] p-3 ${active ? 'border-ink bg-surface' : 'border-line bg-surface-2'}`}
            >
              <View className="flex-1">
                <Text className="font-body-semibold text-sm">{t.label}</Text>
                <Text className="text-xs text-muted">{t.hint}</Text>
              </View>
              {active && <Check size={18} color={theme.ink} />}
            </Pressable>
          );
        })}
        {!!client && f.templateId !== recommended && (
          <Pressable onPress={() => setF((x) => ({ ...x, templateId: recommended }))} className="self-start py-1">
            <Text className="font-body-medium text-sm text-accent-ink">Use recommended template</Text>
          </Pressable>
        )}
        <Text className="text-xs text-muted">Changing templates updates suggested text you have not edited. Your own writing is kept.</Text>
      </Card>

      <DateField label="Quotation date *" value={f.issueDate} onChange={set('issueDate')} error={err('issueDate')} />
      <DateField
        label="Valid until"
        value={f.validUntil}
        onChange={set('validUntil')}
        onClear={() => set('validUntil')('')}
        minDate={f.issueDate || undefined}
        placeholder="No end date"
        error={badDates ? 'Must be on or after the quotation date' : err('validUntil')}
      />
      <View className="gap-1.5">
        <Text className="font-body-medium text-sm">GST rate</Text>
        <View className="flex-row flex-wrap gap-2">
          {GST_RATES.map((r) => <Chip key={r} label={`${r}%`} active={Number(f.taxRate) === r} onPress={() => set('taxRate')(r)} />)}
        </View>
      </View>
      <Input label="Client budget (₹)" value={f.budget} onChangeText={(v) => set('budget')(v.replace(/[^0-9.]/g, ''))} placeholder="e.g. 175000" keyboardType="decimal-pad" error={err('budget')} />
      <Input label="Quotation price / subtotal (₹)" value={f.price} onChangeText={(v) => set('price')(v.replace(/[^0-9.]/g, ''))} placeholder="e.g. 150000" keyboardType="decimal-pad" error={err('price')} />
      <Card className="flex-row flex-wrap px-4 py-2.5">
        <Summary label="Budget" value={formatCurrencyExact(f.budget)} />
        <Summary label="Subtotal" value={formatCurrencyExact(m.price)} />
        <Summary label={`GST (${m.taxRate}%)`} value={formatCurrencyExact(m.taxAmount)} />
        <Summary label="Total" value={formatCurrencyExact(m.total)} strong />
      </Card>

      <View className="gap-1">
        <Text className="font-body-semibold">Write the document</Text>
        <Text className="text-sm text-muted">Each section below is a page in the final PDF. Review the pages as a PDF after saving.</Text>
      </View>

      <PageSection
        page="01"
        title={pani ? 'Letter and event coverage' : 'Cover letter'}
        description={pani ? 'Page 1: recipient greeting, introduction and event-day scope.' : 'Page 1: recipient greeting and your proposal letter.'}
        onRestore={restore(['salutation', 'letterBody', 'letterSignoff', 'scopeIntro', 'scopeOfWork'])}
        open={openPage === '01'}
        onToggle={toggle('01')}
      >
        {text('salutation', 'Greeting', 1, { placeholder: 'Dear Client,' })}
        {text('letterBody', 'Letter text', 7, { placeholder: 'Introduce the proposal. Separate paragraphs with a blank line.' })}
        {pani ? (
          <>
            {text('scopeIntro', 'Scope introduction', 3, { placeholder: 'Our team will cover the celebrations...' })}
            {text('scopeOfWork', 'Event dates and crew / scope', 6, { placeholder: '30th November - 2 story catchers, 2 cinematographers\n1st December - 3 story catchers, 3 cinematographers, 1 drone', hint: 'One line per date or service. These lines also appear on the pricing page.' })}
          </>
        ) : (
          text('letterSignoff', 'Sign-off', 2)
        )}
      </PageSection>

      {pani ? (
        <>
          <PageSection page="02" title="Deliverables and closing" description="Page 2: what the client receives, followed by your closing and signature." onRestore={restore(['deliverables', 'closingNote', 'letterSignoff'])} open={openPage === '02'} onToggle={toggle('02')}>
            {text('deliverables', 'Deliverables', 6, { placeholder: 'One deliverable per line' })}
            {text('closingNote', 'Closing paragraph', 3)}
            {text('letterSignoff', 'Sign-off', 2)}
          </PageSection>
          <PageSection page="03" title="Terms and conditions" description="Page 3: payment schedule and individual conditions. Review these before sending." onRestore={restore(['paymentTerms', 'conditions'])} open={openPage === '03'} onToggle={toggle('03')}>
            {text('paymentTerms', 'Payment terms', 4, { placeholder: 'One payment milestone per line' })}
            {text('conditions', 'Conditions', 8, { placeholder: 'One condition per line' })}
          </PageSection>
          <PageSection page="04" title="Quotation and pricing" description="Page 4: billed-to details, scope, deliverables, bank details and totals." open={openPage === '04'} onToggle={toggle('04')}>
            {text('scopeTitle', 'Service name for invoice', 1, { placeholder: 'Wedding Photography & Cinematography', hint: 'Used to describe the item when you create an invoice from this quotation.' })}
            {text('note', 'Invoice note (not printed on this template)', 3)}
          </PageSection>
        </>
      ) : (
        <>
          <PageSection page="02" title="Scope of work" description="Page 2: subject, scope and deliverables, using the selected project when available." onRestore={restore(['subject', 'scopeTitle', 'scopeIntro', 'scopeOfWork', 'deliverables'])} open={openPage === '02'} onToggle={toggle('02')}>
            {text('subject', 'Subject', 1)}
            {text('scopeTitle', 'Scope heading', 2)}
            {text('scopeIntro', 'Scope introduction', 3)}
            {text('scopeOfWork', 'Scope items', 7, { placeholder: 'One item per line' })}
            {text('deliverables', 'Deliverables', 5, { placeholder: 'One deliverable per line' })}
          </PageSection>
          <PageSection page="03" title="Summary note" description="Page 3: payment note beside the quotation totals." onRestore={restore(['note'])} open={openPage === '03'} onToggle={toggle('03')}>
            {text('note', 'Note', 4)}
          </PageSection>
        </>
      )}

      <Card className="gap-4 p-4">
        <Pressable onPress={() => setPrinted((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: printed }} className="flex-row items-center gap-3">
          <Text className="flex-1 font-body-semibold">Edit printed recipient, company and bank details</Text>
          {printed ? <ChevronUp size={20} color={theme.muted} /> : <ChevronDown size={20} color={theme.muted} />}
        </Pressable>
        {printed && (
          <>
            <Text className="text-sm text-muted">Prefilled from the client and company record. Changes here affect this quotation only. The quotation number and brand logos are system-managed.</Text>
            <Text className="text-caption text-muted">BILLED TO / RECIPIENT</Text>
            {text('recipientName', 'Recipient name', 1)}
            {text('clientReference', 'Printed client ID', 1)}
            {text('recipientEmail', 'Recipient email', 1, { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false })}
            {text('recipientPhone', 'Recipient phone', 1, { keyboardType: 'phone-pad' })}
            {text('recipientGst', 'Recipient GST', 1, { autoCapitalize: 'characters' })}
            {text('projectReference', 'Printed project reference', 1)}
            {text('recipientAddress', 'Recipient address', 3)}
            <Text className="text-caption text-muted">ISSUER AND FOOTER</Text>
            {text('issuerName', 'Issuer name', 1)}
            {text('issuerAddress', 'Issuer address', 3)}
            {text('issuerEmail', 'Issuer email', 1, { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false })}
            {text('issuerPhone', 'Issuer phone', 1, { keyboardType: 'phone-pad' })}
            {text('issuerWebsite', 'Issuer website', 1, { autoCapitalize: 'none', autoCorrect: false, keyboardType: 'url' })}
            {text('issuerGst', 'Issuer GST', 1, { autoCapitalize: 'characters' })}
            {text('signatoryName', 'Signature name', 1)}
            <Text className="text-caption text-muted">BANK DETAILS</Text>
            {text('bankName', 'Bank name', 1)}
            {text('bankAccountName', 'Account name', 1)}
            {text('bankAccountNumber', 'Account number', 1, { keyboardType: 'number-pad' })}
            {text('bankIfsc', 'IFSC code', 1, { autoCapitalize: 'characters' })}
            {text('bankGst', 'Bank GST', 1, { autoCapitalize: 'characters' })}
            {text('bankUpi', 'UPI ID', 1, { autoCapitalize: 'none', autoCorrect: false })}
          </>
        )}
      </Card>

      {!editing && !!f.client && defaultsQ.isError && (
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 text-sm text-danger">{"Couldn't load this client's details."}</Text>
          <Button title="Try again" size="sm" variant="secondary" onPress={defaultsQ.refetch} />
        </View>
      )}
      <Button
        title={!editing && !!f.client && !defaultsReady && !defaultsQ.isError ? 'Loading client details…' : submitLabel}
        loading={loading}
        disabled={!ready}
        onPress={() => onSubmit(docBody(f, { lockIdentity: !!locked }))}
      />
    </>
  );
}

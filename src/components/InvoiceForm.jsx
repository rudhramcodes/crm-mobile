import { useState } from 'react';
import { View } from 'react-native';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react-native';
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
import { formatCurrencyExact } from '@/utils/formatters';
import { applyClient, applyProject, invoiceBody, invoiceForm, invoiceProblem, invoiceTotals, newItem } from '@/utils/invoices';
import { GST_RATES } from '@/utils/quotations';

const area = (rows) => ({ height: rows * 22 + 28, paddingTop: 14, textAlignVertical: 'top' });
const num = (v) => v.replace(/[^0-9.]/g, '');

function Fold({ title, open, onToggle, children }) {
  const theme = useTheme();
  return (
    <Card className="gap-4 p-4">
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} className="flex-row items-center gap-3">
        <Text className="flex-1 font-body-semibold">{title}</Text>
        {open ? <ChevronUp size={20} color={theme.muted} /> : <ChevronDown size={20} color={theme.muted} />}
      </Pressable>
      {open && children}
    </Card>
  );
}

function Line({ label, value, strong, danger }) {
  return (
    <View className="flex-row justify-between">
      <Text className={strong ? 'font-body-semibold' : 'text-sm text-muted'}>{label}</Text>
      <Text className={`tabular-nums ${strong ? 'font-body-semibold' : 'text-sm'} ${danger ? 'text-danger' : ''}`}>{value}</Text>
    </View>
  );
}

// The web InvoiceForm on a phone. `initial`: the invoice (edit) or a quotation prefill; nothing for a blank invoice.
// `lockIdentity`: client and project fixed (invoice from a quotation must match it).
export function InvoiceForm({ initial, lockIdentity, onSubmit, submitLabel, loading, fieldError }) {
  const theme = useTheme();
  const [f, setF] = useState(() => ({ ...invoiceForm(initial), _dirty: [] }));
  const [openAddress, setOpenAddress] = useState(false);
  const [openPrinted, setOpenPrinted] = useState(false);
  const err = (k) => fieldError?.(k);
  const dirtyOf = (x) => new Set(x._dirty);
  const mark = (x, k) => (x._dirty.includes(k) ? x._dirty : [...x._dirty, k]);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v, _dirty: mark(x, k) }));
  const setAddr = (k) => (v) => setF((x) => ({ ...x, billingAddress: { ...x.billingAddress, [k]: v }, _dirty: mark(x, `billingAddress.${k}`) }));
  const setItem = (i, k) => (v) => setF((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) }));

  const clientsQ = useGetClientsQuery({ limit: 100 });
  const clients = clientsQ.data?.data || [];
  const projectsQ = useGetProjectsQuery({ limit: 100 }, { skip: !f.client });
  const projects = (projectsQ.data?.data || []).filter((p) => String(p.client?._id || p.client) === String(f.client));
  const lockedClient = initial?.client?.companyName || clients.find((c) => String(c._id) === String(f.client))?.companyName || 'Client';
  const lockedProject = initial?.project?.title || projects.find((p) => String(p._id) === String(f.project))?.title || '';

  // Like the web: a new blank invoice copies the client's name, contact, GST, ID and address into the printed fields.
  const pickClient = (id) => {
    const c = clients.find((x) => String(x._id) === String(id));
    setF((x) => ({ ...(initial ? x : applyClient(x, c, dirtyOf(x))), client: id, project: '' }));
  };
  const pickProject = (id) => {
    const p = projects.find((x) => String(x._id) === String(id));
    setF((x) => ({ ...(initial ? x : applyProject(x, p, dirtyOf(x))), project: id }));
  };

  const t = invoiceTotals(f.items, f.taxRate, f.discountPercent);
  const problem = invoiceProblem(f);
  const rates = [...new Set([...GST_RATES, Number(f.taxRate)])].sort((a, b) => a - b); // keeps a quotation's odd rate selectable
  const text = (k, label, extra = {}) => <Input label={label} value={f[k]} onChangeText={set(k)} error={err(k)} {...extra} />;

  return (
    <>
      {lockIdentity ? (
        <Card className="gap-1 p-4">
          <Text className="font-body-semibold">{lockedClient}</Text>
          {!!lockedProject && <Text className="text-sm text-muted">{lockedProject}</Text>}
          <Text className="text-xs text-muted">{"Client and project come from the quotation and can't change."}</Text>
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

      <DateField label="Issue date *" value={f.issueDate} onChange={set('issueDate')} error={err('issueDate')} />
      <DateField
        label="Due date *"
        value={f.dueDate}
        onChange={set('dueDate')}
        minDate={f.issueDate || undefined}
        error={f.dueDate && f.issueDate && f.dueDate < f.issueDate ? 'Due date must be on or after issue date' : err('dueDate')}
      />

      <View className="gap-3">
        <View className="flex-row items-center">
          <Text className="flex-1 font-body-semibold">Invoice items</Text>
          <Button title="Add item" icon={Plus} size="sm" variant="secondary" onPress={() => setF((x) => ({ ...x, items: [...x.items, newItem()] }))} />
        </View>
        {!!err('items') && <Text className="text-sm text-danger">{err('items')}</Text>}
        {f.items.map((it, i) => (
          <Card key={i} className="gap-2 p-3">
            <View className="flex-row items-start gap-2">
              <View className="flex-1">
                <Input value={it.description} onChangeText={setItem(i, 'description')} placeholder="Item description, e.g. Wedding photography" maxLength={500} accessibilityLabel={`Item ${i + 1} description`} />
              </View>
              {f.items.length > 1 && (
                <Pressable onPress={() => setF((x) => ({ ...x, items: x.items.filter((_, j) => j !== i) }))} accessibilityLabel={`Remove item ${i + 1}`} className="h-[52px] w-10 items-center justify-center">
                  <Trash2 size={18} color={theme.danger} />
                </Pressable>
              )}
            </View>
            <View className="flex-row items-center gap-2">
              <View className="w-20">
                <Input value={it.quantity} onChangeText={(v) => setItem(i, 'quantity')(v.replace(/\D/g, ''))} placeholder="Qty" keyboardType="number-pad" accessibilityLabel={`Item ${i + 1} quantity`} />
              </View>
              <Text className="text-muted">×</Text>
              <View className="flex-1">
                <Input value={it.unitPrice} onChangeText={(v) => setItem(i, 'unitPrice')(num(v))} placeholder="Rate" keyboardType="decimal-pad" accessibilityLabel={`Item ${i + 1} rate`} />
              </View>
              <Text className="w-24 text-right font-body-semibold text-sm tabular-nums">
                {formatCurrencyExact((parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0))}
              </Text>
            </View>
          </Card>
        ))}
      </View>

      <View className="gap-1.5">
        <Text className="font-body-medium text-sm">GST rate</Text>
        <View className="flex-row flex-wrap gap-2">
          {rates.map((r) => <Chip key={r} label={`${r}%`} active={Number(f.taxRate) === r} onPress={() => set('taxRate')(r)} />)}
        </View>
      </View>
      <Input label="Discount %" value={f.discountPercent} onChangeText={(v) => set('discountPercent')(num(v))} placeholder="0" keyboardType="decimal-pad" maxLength={5} error={err('discountPercent')} />
      <Card className="gap-2 p-4">
        <Line label="Subtotal" value={formatCurrencyExact(t.subtotal)} />
        <Line label={`GST (${Number(f.taxRate) || 0}%)`} value={formatCurrencyExact(t.taxAmount)} />
        <Line label={`Discount (${parseFloat(f.discountPercent) || 0}%)`} value={`−${formatCurrencyExact(t.discountAmount)}`} danger={t.discountAmount > 0} />
        <View className="border-t border-line pt-2">
          <Line label="Total" value={formatCurrencyExact(t.total)} strong />
        </View>
      </Card>

      <Fold title="Billing address" open={openAddress} onToggle={() => setOpenAddress((o) => !o)}>
        <Input label="Street" value={f.billingAddress.street} onChangeText={setAddr('street')} placeholder="Street address" />
        <Input label="City" value={f.billingAddress.city} onChangeText={setAddr('city')} placeholder="City" autoCapitalize="words" />
        <Input label="State" value={f.billingAddress.state} onChangeText={setAddr('state')} placeholder="State" autoCapitalize="words" />
        <Input label="Pincode" value={f.billingAddress.pincode} onChangeText={setAddr('pincode')} placeholder="Pincode" keyboardType="number-pad" />
        <Input label="Country" value={f.billingAddress.country} onChangeText={setAddr('country')} placeholder="Country" autoCapitalize="words" />
      </Fold>

      <Fold title="Edit printed client, issuer and bank details" open={openPrinted} onToggle={() => setOpenPrinted((o) => !o)}>
        <Text className="text-sm text-muted">These fields control what appears on this invoice. Blank issuer or bank fields use the current company details; changing them does not edit the client record.</Text>
        <Text className="text-caption text-muted">BILLED TO</Text>
        {text('recipientName', 'Printed client name')}
        {text('clientReference', 'Printed client ID')}
        {text('recipientEmail', 'Printed client email', { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false })}
        {text('recipientPhone', 'Printed client phone', { keyboardType: 'phone-pad' })}
        {text('recipientGst', 'Printed client GST', { autoCapitalize: 'characters' })}
        {text('projectReference', 'Printed project reference')}
        <Text className="text-caption text-muted">ISSUER</Text>
        {text('issuerName', 'Issuer name')}
        {text('issuerAddress', 'Issuer address', { multiline: true, style: area(3) })}
        {text('issuerEmail', 'Issuer email', { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false })}
        {text('issuerPhone', 'Issuer phone', { keyboardType: 'phone-pad' })}
        {text('issuerGst', 'Issuer GST', { autoCapitalize: 'characters' })}
        {text('signatoryName', 'Signature name')}
        <Text className="text-caption text-muted">BANK DETAILS</Text>
        {text('bankName', 'Bank name')}
        {text('bankAccountName', 'Account name')}
        {text('bankAccountNumber', 'Account number', { keyboardType: 'number-pad' })}
        {text('bankIfsc', 'IFSC code', { autoCapitalize: 'characters' })}
        {text('bankGst', 'Bank GST', { autoCapitalize: 'characters' })}
        {text('bankUpi', 'UPI ID', { autoCapitalize: 'none', autoCorrect: false })}
      </Fold>

      {text('notes', 'Notes', { placeholder: 'Additional notes...', multiline: true, style: area(3), maxLength: 2000 })}
      {text('termsConditions', 'Terms & conditions', { placeholder: 'Payment terms, delivery terms...', multiline: true, style: area(3), maxLength: 2000 })}

      {!!problem && !!f.client && <Text className="text-sm text-muted">{problem}</Text>}
      <Button title={submitLabel} loading={loading} disabled={!!problem} onPress={() => onSubmit(invoiceBody(f, { editing: !!initial?._id }))} />
    </>
  );
}

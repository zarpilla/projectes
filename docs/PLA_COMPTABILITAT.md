# PLA DEL MÒDUL DE COMPTABILITAT
## ERP per Espanya - Normativa PGC i AEAT

**Data:** 18 maig 2026  
**Versió:** 1.0  
**Àmbit territorial:** Espanya

---

## ÍNDEX

1. [Anàlisi de l'estat actual](#1-anàlisi-de-lestat-actual)
2. [Arquitectura del mòdul comptable](#2-arquitectura-del-mòdul-comptable)
3. [Models de dades (Strapi)](#3-models-de-dades-strapi)
4. [Pla comptable espanyol](#4-pla-comptable-espanyol)
5. [Configuració d'IVA i impostos](#5-configuració-diva-i-impostos)
6. [Fluxos automàtics d'assentaments](#6-fluxos-automàtics-dassentaments)
7. [Informes comptables](#7-informes-comptables)
8. [Reconciliació bancària](#8-reconciliació-bancària)
9. [Fases d'implementació](#9-fases-dimplementació)
10. [Consideracions tècniques](#10-consideracions-tècniques)

---

## 1. ANÀLISI DE L'ESTAT ACTUAL

### 1.1 Models existents rellevants

El sistema actual ja té:

#### Documents comercials
- **emitted_invoices**: Factures emeses amb línies, IVA, IRPF, projectes
- **received_invoices**: Factures rebudes
- **received_expenses**: Despeses (tiquets, factures simplificades)
- **payrolls**: Nòmines amb desglossaments (net, IRPF, SS)

#### Gestió financera
- **bank_accounts**: Comptes bancaris
- **payment_methods**: Formes de pagament vinculades a comptes
- **vat_types**: Tipus d'IVA (només percentatge)

#### Gestió d'empresa
- **years**: Exercicis amb working_hours, deductible_vat_pct
- **contacts**: Clients i proveïdors
- **projects**: Projectes amb fases, ingressos, despeses

### 1.2 Funcionalitats actuals

✅ **IMPLEMENTAT:**
- Facturació emesa i rebuda
- Control de cobraments/pagaments
- Gestió d'IVA bàsica
- Nòmines
- Tresoreria
- Integració FACe i Verifactu

❌ **NO IMPLEMENTAT:**
- Comptabilitat doble partida
- Llibres comptables oficials
- Balanç ni compte de pèrdues i guanys
- Pla comptable estructurat
- Models AEAT automatitzats (303, 390)
- Assentaments comptables

---

## 2. ARQUITECTURA DEL MÒDUL COMPTABLE

### 2.1 Les 3 capes

```
┌─────────────────────────────────────┐
│  CAPA 1: MODEL COMPTABLE            │
│  - Comptes (PGC)                    │
│  - Assentaments (Journal Entries)   │
│  - DEBE/HABER                       │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  CAPA 2: LÒGICA FISCAL              │
│  - IVA (repercutit/suportat)        │
│  - IRPF                             │
│  - Règims especials                 │
│  - Models AEAT                      │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  CAPA 3: OPERATIVA ERP              │
│  - Factures → Assentaments          │
│  - Cobraments → Assentaments        │
│  - Nòmines → Assentaments           │
│  - Conciliació bancària             │
└─────────────────────────────────────┘
```

### 2.2 Principis fonamentals

1. **Immutabilitat**: Els assentaments validats NO es poden editar
2. **Auditabilitat**: Traçabilitat completa (document origen → assentament)
3. **Recalculabilitat**: Els saldos sempre es calculen, NO s'emmagatzemen
4. **Doble partida**: DEBE = HABER sempre
5. **Segregació**: Comptabilitat separada de la facturació/operativa

### 2.3 Flux de dades

```
Factura emesa (DRAFT) 
    ↓
Factura emesa (REAL) → Genera assentament (DRAFT)
    ↓                           ↓
Validació manual        → Assentament (POSTED) ← Immutable
    ↓
Cobrament → Genera assentament de cobrament
```

---

## 3. MODELS DE DADES (STRAPI)

### 3.1 Fiscal Years (Exercicis comptables)

**Modificar el model `year` existent:**

```json
{
  "collectionName": "years",
  "attributes": {
    "year": { "type": "integer" },
    "working_hours": { "type": "decimal" },
    "deductible_vat_pct": { "type": "decimal" },
    
    // NOUS CAMPS COMPTABLES
    "start_date": { 
      "type": "date",
      "required": true
    },
    "end_date": { 
      "type": "date",
      "required": true
    },
    "closed": { 
      "type": "boolean",
      "default": false
    },
    "closed_date": { 
      "type": "datetime"
    },
    "closed_by": {
      "plugin": "users-permissions",
      "model": "user"
    }
  }
}
```

**Migració:**
```javascript
// Script de migració per exercicis existents
async function migrateYears() {
  const years = await strapi.query('year').find();
  
  for (const year of years) {
    await strapi.query('year').update({ id: year.id }, {
      start_date: `${year.year}-01-01`,
      end_date: `${year.year}-12-31`,
      closed: false
    });
  }
}
```

### 3.2 Accounting Journal (Diari comptable)

**Nou model: `accounting-journal`**

```json
{
  "kind": "collectionType",
  "collectionName": "accounting_journals",
  "info": {
    "name": "Accounting Journal",
    "description": "Diaris comptables (vendes, compres, banc, etc.)"
  },
  "options": {
    "increments": true,
    "timestamps": true,
    "draftAndPublish": false
  },
  "attributes": {
    "code": { 
      "type": "string",
      "required": true,
      "unique": true,
      "maxLength": 10
    },
    "name": { 
      "type": "string",
      "required": true
    },
    "type": {
      "type": "enumeration",
      "enum": [
        "SALES", 
        "PURCHASES", 
        "BANK", 
        "CASH", 
        "GENERAL", 
        "OPENING", 
        "CLOSING"
      ],
      "required": true
    },
    "default_debit_account": {
      "model": "accounting-account"
    },
    "default_credit_account": {
      "model": "accounting-account"
    },
    "sequence_prefix": {
      "type": "string",
      "maxLength": 5
    },
    "active": {
      "type": "boolean",
      "default": true
    }
  }
}
```

**Exemples de diaris (seed data):**

| Code | Name | Type | Prefix |
|------|------|------|--------|
| VT | Vendes | SALES | VT |
| CO | Compres | PURCHASES | CO |
| BAN | Banc | BANK | BAN |
| CAI | Caixa | CASH | CAI |
| NOM | Nòmines | GENERAL | NOM |
| OPE | Operacions diverses | GENERAL | OPE |
| APE | Assentament d'obertura | OPENING | APE |
| CIE | Assentament de tancament | CLOSING | CIE |

### 3.3 Accounting Account (Pla comptable)

**Nou model: `accounting-account`**

```json
{
  "kind": "collectionType",
  "collectionName": "accounting_accounts",
  "info": {
    "name": "Accounting Account",
    "description": "Pla comptable PGC"
  },
  "options": {
    "increments": true,
    "timestamps": true,
    "draftAndPublish": false
  },
  "attributes": {
    "code": { 
      "type": "string",
      "required": true,
      "unique": true,
      "maxLength": 20
    },
    "name": { 
      "type": "string",
      "required": true
    },
    "type": {
      "type": "enumeration",
      "enum": [
        "ASSET",           // Actiu
        "LIABILITY",       // Passiu
        "EQUITY",          // Patrimoni net
        "INCOME",          // Ingressos
        "EXPENSE"          // Despeses
      ],
      "required": true
    },
    "parent": {
      "model": "accounting-account"
    },
    "level": {
      "type": "integer",
      "min": 1,
      "max": 5
    },
    "reconcile": {
      "type": "boolean",
      "default": false,
      "description": "Si és true, requereix conciliació (clients, proveïdors, bancs)"
    },
    "currency_exchange": {
      "type": "boolean",
      "default": false
    },
    "deprecated": {
      "type": "boolean",
      "default": false
    },
    "contact": {
      "model": "contacts",
      "description": "Compte auxiliar d'un client/proveïdor específic"
    },
    "bank_account": {
      "model": "bank-accounts",
      "description": "Compte comptable d'un banc específic"
    },
    "note": {
      "type": "text"
    }
  }
}
```

### 3.4 Journal Entry (Assentament comptable)

**Nou model: `journal-entry`**

```json
{
  "kind": "collectionType",
  "collectionName": "journal_entries",
  "info": {
    "name": "Journal Entry",
    "description": "Assentaments comptables"
  },
  "options": {
    "increments": true,
    "timestamps": true,
    "draftAndPublish": false
  },
  "attributes": {
    "number": {
      "type": "string",
      "required": true,
      "unique": true
    },
    "fiscal_year": {
      "model": "year",
      "required": true
    },
    "journal": {
      "model": "accounting-journal",
      "required": true
    },
    "date": {
      "type": "date",
      "required": true
    },
    "reference": {
      "type": "string"
    },
    "concept": {
      "type": "text",
      "required": true
    },
    "state": {
      "type": "enumeration",
      "enum": ["DRAFT", "POSTED", "CANCELLED"],
      "default": "DRAFT",
      "required": true
    },
    "posted_date": {
      "type": "datetime"
    },
    "posted_by": {
      "plugin": "users-permissions",
      "model": "user"
    },
    
    // TRAÇABILITAT: Document origen
    "source_model": {
      "type": "string",
      "description": "emitted-invoice, received-invoice, received-expense, payroll, treasury, manual"
    },
    "source_id": {
      "type": "integer"
    },
    
    // Relacions directes (redundant però útil per queries)
    "emitted_invoice": {
      "model": "emitted-invoice"
    },
    "received_invoice": {
      "model": "received-invoice"
    },
    "received_expense": {
      "model": "received-expense"
    },
    "payroll": {
      "model": "payroll"
    },
    
    "reversal_of": {
      "model": "journal-entry",
      "description": "Assentament que reverteix (si és una cancel·lació)"
    },
    
    "note": {
      "type": "text"
    }
  }
}
```

### 3.5 Journal Entry Line (Línies d'assentament)

**Nou model: `journal-entry-line`**

```json
{
  "kind": "collectionType",
  "collectionName": "journal_entry_lines",
  "info": {
    "name": "Journal Entry Line",
    "description": "Línies d'assentaments comptables"
  },
  "options": {
    "increments": true,
    "timestamps": false,
    "draftAndPublish": false
  },
  "attributes": {
    "journal_entry": {
      "model": "journal-entry",
      "required": true
    },
    "sequence": {
      "type": "integer",
      "description": "Ordre de la línia dins l'assentament"
    },
    "account": {
      "model": "accounting-account",
      "required": true
    },
    "label": {
      "type": "string",
      "required": true
    },
    "debit": {
      "type": "decimal",
      "default": 0
    },
    "credit": {
      "type": "decimal",
      "default": 0
    },
    "contact": {
      "model": "contacts",
      "description": "Client/Proveïdor associat a aquesta línia"
    },
    "tax_line": {
      "type": "boolean",
      "default": false,
      "description": "Marca si és una línia d'impost (IVA, IRPF)"
    },
    "tax_base_amount": {
      "type": "decimal",
      "description": "Base imposable si és línia d'impost"
    },
    "reconcile_ref": {
      "type": "string",
      "description": "Referència de conciliació"
    },
    "reconciled": {
      "type": "boolean",
      "default": false
    },
    "reconciled_date": {
      "type": "date"
    }
  }
}
```

### 3.6 Tax Configuration (Configuració d'impostos)

**Nou model: `tax-config`** (o ampliar `vat-type`)

```json
{
  "kind": "collectionType",
  "collectionName": "tax_configs",
  "info": {
    "name": "Tax Configuration",
    "description": "Configuració d'IVA i altres impostos"
  },
  "options": {
    "increments": true,
    "timestamps": true,
    "draftAndPublish": false
  },
  "attributes": {
    "code": {
      "type": "string",
      "required": true,
      "unique": true
    },
    "name": {
      "type": "string",
      "required": true
    },
    "type": {
      "type": "enumeration",
      "enum": ["VAT_COLLECTED", "VAT_PAID", "IRPF", "RETENTION"],
      "required": true
    },
    "rate": {
      "type": "decimal",
      "required": true
    },
    "account_collected": {
      "model": "accounting-account",
      "description": "Compte d'IVA repercutit o retenció practicada"
    },
    "account_paid": {
      "model": "accounting-account",
      "description": "Compte d'IVA suportat o retenció suportada"
    },
    "vat_regime": {
      "type": "enumeration",
      "enum": [
        "GENERAL",
        "EXEMPT",
        "INTRA_EU",
        "REVERSE_CHARGE",
        "EXPORT",
        "REDUCED",
        "SUPER_REDUCED"
      ]
    },
    "description": {
      "type": "text"
    },
    "active": {
      "type": "boolean",
      "default": true
    }
  }
}
```

**Exemples de configuració (seed data):**

| Code | Name | Type | Rate | Regime | Account Collected | Account Paid |
|------|------|------|------|--------|-------------------|--------------|
| IVA21 | IVA 21% | VAT_COLLECTED | 21 | GENERAL | 477000 | 472000 |
| IVA10 | IVA 10% | VAT_COLLECTED | 10 | REDUCED | 477000 | 472000 |
| IVA4 | IVA 4% | VAT_COLLECTED | 4 | SUPER_REDUCED | 477000 | 472000 |
| IVAEXE | IVA Exempt | VAT_COLLECTED | 0 | EXEMPT | - | - |
| IVAUE | IVA Intracomunitari | VAT_COLLECTED | 0 | INTRA_EU | 477700 | 472700 |
| IVAINV | Inversió subjecte passiu | VAT_COLLECTED | 0 | REVERSE_CHARGE | - | - |
| IRPF15 | IRPF 15% | IRPF | 15 | - | 4751 | - |
| IRPF7 | IRPF 7% | IRPF | 7 | - | 4751 | - |

---

## 4. PLA COMPTABLE ESPANYOL

### 4.1 Estructura del PGC

```
GRUP 1: FINANÇAMENT BÀSIC
  10 - Capital
  11 - Reserves
  12 - Resultats pendents d'aplicació
  13 - Subvencions, donacions i llegats rebuts

GRUP 2: ACTIU NO CORRENT
  20 - Immobilitzat intangible
  21 - Immobilitzat material
  22 - Inversions immobiliàries
  23 - Inversions financeres a llarg termini
  28 - Amortització acumulada de l'immobilitzat
  29 - Deteriorament de valor de l'actiu no corrent

GRUP 3: EXISTÈNCIES
  30 - Comercials
  31 - Matèries primeres
  32 - Altres aprovisionaments
  33 - Productes en curs
  34 - Productes acabats
  35 - Subproductes, residus i materials recuperats
  36 - Productes en curs

GRUP 4: CREDITORS I DEUTORS PER OPERACIONS COMERCIALS
  40 - Proveïdors
  41 - Creditors diversos
  43 - Clients
  44 - Deutors diversos
  46 - Personal
  47 - Administracions públiques
  48 - Ajustaments per periodificació
  49 - Deteriorament de valor de crèdits comercials

GRUP 5: COMPTES FINANCERS
  50 - Emprèstits i deutes amb característiques especials
  51 - Deutes a curt termini amb parts vinculades
  52 - Deutes a curt termini
  53 - Inversions financeres a curt termini
  54 - Altres actius financers
  55 - Altres passivs financers
  56 - Fiances i dipòsits rebuts i constituïts
  57 - Tresoreria
  58 - Actius no corrents mantinguts per a la venda
  59 - Deteriorament de valor d'inversions financeres

GRUP 6: COMPRES I DESPESES
  60 - Compres
  61 - Variació d'existències
  62 - Serveis exteriors
  63 - Tributs
  64 - Despeses de personal
  65 - Altres despeses de gestió
  66 - Despeses financeres
  67 - Pèrdues procedents d'actius no corrents
  68 - Dotacions per amortitzacions
  69 - Pèrdues per deteriorament i altres dotacions

GRUP 7: VENDES I INGRESSOS
  70 - Vendes de mercaderies, de producció pròpia, etc.
  71 - Variació d'existències
  73 - Treballs realitzats per a l'empresa
  74 - Subvencions, donacions i llegats a l'explotació
  75 - Altres ingressos de gestió
  76 - Ingressos financers
  77 - Beneficis procedents d'actius no corrents
  79 - Excessos i aplicacions de provisions

GRUP 8: DESPESES IMPUTADES AL PATRIMONI NET

GRUP 9: INGRESSOS IMPUTATS AL PATRIMONI NET
```

### 4.2 Comptes imprescindibles per començar

#### TRESORERIA (57)
```
570000 - Caixa, euros
572000 - Banc [compte genèric]
572XXX - Banc [compte per cada bank_account]
```

#### CLIENTS (43)
```
430000 - Clients (genèric)
4300XXX - Client específic [un per cada contact client]
4310XX - Efectes comercials a cobrar
437000 - Enviaments en consignació
```

#### PROVEÏDORS (40-41)
```
400000 - Proveïdors (genèric)
4000XXX - Proveïdor específic [un per cada contact proveïdor]
410000 - Creditors per prestacions de serveis
411000 - Creditors, efectes comercials a pagar
```

#### ADMINISTRACIONS PÚBLIQUES (47)
```
472000 - HP IVA suportat
472100 - HP IVA suportat deduïble (si deductible_vat_pct < 100)
472700 - HP IVA suportat intracomunitari
477000 - HP IVA repercutit
477700 - HP IVA repercutit intracomunitari
4750 - HP Acreedor per retencions practicades (IRPF que retenim)
4751 - HP Acreedor per Seguretat Social
4752 - HP Acreedor per IRPF (retencions de nòmines)
473000 - HP Retenció IVA suportada
476000 - Organismes de la Seguretat Social, deutors
```

#### VENDES (70)
```
700000 - Vendes de mercaderies
705000 - Prestacions de serveis
708000 - Devolucions de vendes i operacions similars
709000 - Ràpels sobre vendes
```

#### COMPRES (60)
```
600000 - Compres de mercaderies
602000 - Compres d'altres aprovisionaments
607000 - Treballs realitzats per altres empreses
608000 - Devolucions de compres
609000 - Ràpels per compres
```

#### SERVEIS EXTERIORS (62)
```
621000 - Arrendaments i canons
622000 - Reparacions i conservació
623000 - Serveis de professionals independents
624000 - Transports
625000 - Primes d'assegurances
626000 - Serveis bancaris i similars
627000 - Publicitat, propaganda i relacions públiques
628000 - Subministraments
629000 - Altres serveis
```

#### PERSONAL (64)
```
640000 - Sous i salaris
641000 - Indemnitzacions
642000 - Seguretat Social a càrrec de l'empresa
649000 - Altres despeses socials
```

#### CAPITAL I RESERVES (10-11)
```
100000 - Capital social
102000 - Capital (cooperativa)
113000 - Reserves voluntàries
118000 - Aportacions de socis o propietaris
129000 - Resultat de l'exercici
```

### 4.3 Script d'importació del PGC

**Fitxer:** `scripts/seed-accounting-accounts.js`

```javascript
module.exports = async () => {
  const accounts = [
    // GRUP 1
    { code: '100000', name: 'Capital social', type: 'EQUITY', level: 1 },
    { code: '102000', name: 'Capital (cooperativa)', type: 'EQUITY', level: 1 },
    { code: '113000', name: 'Reserves voluntàries', type: 'EQUITY', level: 1 },
    { code: '129000', name: 'Resultat de l\'exercici', type: 'EQUITY', level: 1 },
    
    // GRUP 2
    { code: '210000', name: 'Construccions', type: 'ASSET', level: 1 },
    { code: '216000', name: 'Mobiliari', type: 'ASSET', level: 1 },
    { code: '217000', name: 'Equips per a processos d\'informació', type: 'ASSET', level: 1 },
    { code: '218000', name: 'Elements de transport', type: 'ASSET', level: 1 },
    { code: '281000', name: 'Amortització acumulada de l\'immobilitzat material', type: 'ASSET', level: 1 },
    
    // GRUP 4 - CLIENTS
    { code: '430000', name: 'Clients', type: 'ASSET', level: 1, reconcile: true },
    { code: '437000', name: 'Enviaments en consignació', type: 'ASSET', level: 1 },
    
    // GRUP 4 - PROVEÏDORS
    { code: '400000', name: 'Proveïdors', type: 'LIABILITY', level: 1, reconcile: true },
    { code: '410000', name: 'Creditors per prestacions de serveis', type: 'LIABILITY', level: 1 },
    
    // GRUP 4 - ADMINISTRACIONS PÚBLIQUES
    { code: '472000', name: 'HP IVA suportat', type: 'ASSET', level: 1 },
    { code: '472100', name: 'HP IVA suportat deduïble', type: 'ASSET', level: 1 },
    { code: '477000', name: 'HP IVA repercutit', type: 'LIABILITY', level: 1 },
    { code: '4750', name: 'HP Acreedor per retencions practicades', type: 'LIABILITY', level: 1 },
    { code: '4751', name: 'HP Acreedor per Seguretat Social', type: 'LIABILITY', level: 1 },
    { code: '4752', name: 'HP Acreedor per IRPF', type: 'LIABILITY', level: 1 },
    
    // GRUP 5 - TRESORERIA
    { code: '570000', name: 'Caixa, euros', type: 'ASSET', level: 1, reconcile: true },
    { code: '572000', name: 'Bancs e institucions de crèdit', type: 'ASSET', level: 1, reconcile: true },
    
    // GRUP 6 - COMPRES I DESPESES
    { code: '600000', name: 'Compres de mercaderies', type: 'EXPENSE', level: 1 },
    { code: '602000', name: 'Compres d\'altres aprovisionaments', type: 'EXPENSE', level: 1 },
    { code: '607000', name: 'Treballs realitzats per altres empreses', type: 'EXPENSE', level: 1 },
    { code: '621000', name: 'Arrendaments i canons', type: 'EXPENSE', level: 1 },
    { code: '622000', name: 'Reparacions i conservació', type: 'EXPENSE', level: 1 },
    { code: '623000', name: 'Serveis de professionals independents', type: 'EXPENSE', level: 1 },
    { code: '624000', name: 'Transports', type: 'EXPENSE', level: 1 },
    { code: '625000', name: 'Primes d\'assegurances', type: 'EXPENSE', level: 1 },
    { code: '626000', name: 'Serveis bancaris i similars', type: 'EXPENSE', level: 1 },
    { code: '627000', name: 'Publicitat, propaganda i relacions públiques', type: 'EXPENSE', level: 1 },
    { code: '628000', name: 'Subministraments', type: 'EXPENSE', level: 1 },
    { code: '629000', name: 'Altres serveis', type: 'EXPENSE', level: 1 },
    { code: '640000', name: 'Sous i salaris', type: 'EXPENSE', level: 1 },
    { code: '642000', name: 'Seguretat Social a càrrec de l\'empresa', type: 'EXPENSE', level: 1 },
    
    // GRUP 7 - VENDES I INGRESSOS
    { code: '700000', name: 'Vendes de mercaderies', type: 'INCOME', level: 1 },
    { code: '705000', name: 'Prestacions de serveis', type: 'INCOME', level: 1 },
    { code: '708000', name: 'Devolucions de vendes', type: 'INCOME', level: 1 },
    { code: '740000', name: 'Subvencions a l\'explotació', type: 'INCOME', level: 1 },
    { code: '759000', name: 'Ingressos per serveis diversos', type: 'INCOME', level: 1 },
  ];
  
  for (const account of accounts) {
    await strapi.query('accounting-account').create(account);
  }
  
  console.log(`✅ Importats ${accounts.length} comptes comptables`);
};
```

---

## 5. CONFIGURACIÓ D'IVA I IMPOSTOS

### 5.1 Mapeig de comptes per tipus d'IVA

```javascript
// Script seed: scripts/seed-tax-configs.js
module.exports = async () => {
  // Obtenir comptes
  const acc477 = await strapi.query('accounting-account').findOne({ code: '477000' });
  const acc472 = await strapi.query('accounting-account').findOne({ code: '472000' });
  const acc4750 = await strapi.query('accounting-account').findOne({ code: '4750' });
  
  const taxConfigs = [
    {
      code: 'IVA21',
      name: 'IVA 21% (General)',
      type: 'VAT_COLLECTED',
      rate: 21,
      vat_regime: 'GENERAL',
      account_collected: acc477.id,
      account_paid: acc472.id,
      active: true
    },
    {
      code: 'IVA10',
      name: 'IVA 10% (Reduït)',
      type: 'VAT_COLLECTED',
      rate: 10,
      vat_regime: 'REDUCED',
      account_collected: acc477.id,
      account_paid: acc472.id,
      active: true
    },
    {
      code: 'IVA4',
      name: 'IVA 4% (Superreduït)',
      type: 'VAT_COLLECTED',
      rate: 4,
      vat_regime: 'SUPER_REDUCED',
      account_collected: acc477.id,
      account_paid: acc472.id,
      active: true
    },
    {
      code: 'IVAEXE',
      name: 'IVA Exempt',
      type: 'VAT_COLLECTED',
      rate: 0,
      vat_regime: 'EXEMPT',
      active: true
    },
    {
      code: 'IVAUE',
      name: 'IVA Intracomunitari',
      type: 'VAT_COLLECTED',
      rate: 0,
      vat_regime: 'INTRA_EU',
      active: true
    },
    {
      code: 'IVAINV',
      name: 'Inversió subjecte passiu',
      type: 'VAT_COLLECTED',
      rate: 0,
      vat_regime: 'REVERSE_CHARGE',
      active: true
    },
    {
      code: 'IRPF15',
      name: 'IRPF 15%',
      type: 'IRPF',
      rate: 15,
      account_collected: acc4750.id,
      active: true
    },
    {
      code: 'IRPF7',
      name: 'IRPF 7%',
      type: 'IRPF',
      rate: 7,
      account_collected: acc4750.id,
      active: true
    }
  ];
  
  for (const config of taxConfigs) {
    await strapi.query('tax-config').create(config);
  }
  
  console.log(`✅ Creades ${taxConfigs.length} configuracions d'impostos`);
};
```

### 5.2 Gestió d'IVA no deduïble

Si `year.deductible_vat_pct` < 100, per exemple 50%:

**Factura rebuda:** 100€ base + 21€ IVA

```javascript
const deductiblePct = year.deductible_vat_pct; // 50
const nonDeductibleVat = invoice.total_vat * (1 - deductiblePct / 100); // 10,50€
const deductibleVat = invoice.total_vat * (deductiblePct / 100); // 10,50€

// Assentament:
// DEBE:
//   600 Compres         110,50€  (base + IVA no deduïble)
//   472100 IVA suportat ded  10,50€
// HABER:
//   400 Proveïdor       121,00€
```

---

## 6. FLUXOS AUTOMÀTICS D'ASSENTAMENTS

### 6.1 Factura emesa (emitted_invoice)

**Trigger:** `state` passa de `draft` a `real`

**Diari:** SALES (VT)

**Exemple:**
- Base: 100€
- IVA 21%: 21€
- **Total: 121€**

**Assentament:**

| Compte | DEBE | HABER |
|--------|------|-------|
| 430000 Clients | 121,00€ | |
| 700000 Vendes | | 100,00€ |
| 477000 IVA repercutit | | 21,00€ |

**Amb IRPF 15%:**
- Base: 100€
- IVA 21%: 21€
- IRPF 15%: -15€ (retenció)
- **Total: 106€**

| Compte | DEBE | HABER |
|--------|------|-------|
| 430000 Clients | 106,00€ | |
| 4750 HP ret. practicades | 15,00€ | |
| 700000 Vendes | | 100,00€ |
| 477000 IVA repercutit | | 21,00€ |

**Codi:**

```javascript
// api/emitted-invoice/models/emitted-invoice.js
const accountingService = require('../../../services/accounting');

module.exports = {
  lifecycles: {
    async afterUpdate(result, params, data) {
      // Només si passa a real i no té assentament
      if (data.state === 'real' && params.state === 'draft') {
        const existing = await strapi.query('journal-entry')
          .findOne({ 
            source_model: 'emitted-invoice', 
            source_id: result.id 
          });
        
        if (!existing) {
          await accountingService.createInvoiceEntry(result, 'sale');
        }
      }
      
      // Si es marca com a cobrada
      if (data.paid && !params.paid && data.paid_date) {
        await accountingService.createPaymentEntry(result, 'collection');
      }
    }
  }
};
```

### 6.2 Cobrament de factura emesa

**Trigger:** `paid` = true i `paid_date` s'estableix

**Diari:** BANK (BAN)

**Assentament:**

| Compte | DEBE | HABER |
|--------|------|-------|
| 572000 Banc | 121,00€ | |
| 430000 Clients | | 121,00€ |

### 6.3 Factura rebuda (received_invoice)

**Trigger:** Es crea (sempre es considera real)

**Diari:** PURCHASES (CO)

**Exemple:**
- Base: 100€
- IVA 21%: 21€
- **Total: 121€**

**Assentament:**

| Compte | DEBE | HABER |
|--------|------|-------|
| 600000 Compres | 100,00€ | |
| 472000 IVA suportat | 21,00€ | |
| 400000 Proveïdors | | 121,00€ |

**Amb IVA parcialment deduïble (50%):**

| Compte | DEBE | HABER |
|--------|------|-------|
| 600000 Compres | 110,50€ | |
| 472100 IVA suportat ded | 10,50€ | |
| 400000 Proveïdors | | 121,00€ |

### 6.4 Pagament de factura rebuda

**Trigger:** `paid` = true

**Diari:** BANK (BAN)

**Assentament:**

| Compte | DEBE | HABER |
|--------|------|-------|
| 400000 Proveïdors | 121,00€ | |
| 572000 Banc | | 121,00€ |

### 6.5 Despesa rebuda (received_expense)

**Similar a factura rebuda**, però segons `expense_type` usa comptes diferents:

```javascript
const EXPENSE_TYPE_ACCOUNTS = {
  'Subministraments': '628000',
  'Lloguer': '621000',
  'Transport': '624000',
  'Publicitat': '627000',
  'Assegurances': '625000',
  'Serveis bancaris': '626000',
  'Altres': '629000'
};
```

### 6.6 Nòmina (payroll)

**Trigger:** Es crea la nòmina

**Diari:** GENERAL (NOM)

**Exemple:**
- Brut: 2000€
- IRPF treballador: -300€
- SS treballador: -130€
- **Net: 1570€**
- SS empresa: 600€

**Assentament registre nòmina:**

| Compte | DEBE | HABER |
|--------|------|-------|
| 640000 Sous i salaris | 2000,00€ | |
| 642000 SS empresa | 600,00€ | |
| 572000 Banc (net) | | 1570,00€ |
| 4751 HP SS | | 730,00€ |
| 4752 HP IRPF | | 300,00€ |

**Assentament pagament SS i IRPF (trimestral):**

| Compte | DEBE | HABER |
|--------|------|-------|
| 4751 HP SS | 730,00€ | |
| 4752 HP IRPF | 300,00€ | |
| 572000 Banc | | 1030,00€ |

### 6.7 Liquidació IVA trimestral (Model 303)

**Manual o automàtic (trimestral)**

**Càlcul:**
- IVA repercutit (cobrat): 2000€
- IVA suportat (pagat): 800€
- **A ingressar: 1200€**

**Assentament liquidació:**

| Compte | DEBE | HABER |
|--------|------|-------|
| 477000 IVA repercutit | 2000,00€ | |
| 472000 IVA suportat | | 800,00€ |
| 4750 HP IVA a pagar | | 1200,00€ |

**Assentament pagament:**

| Compte | DEBE | HABER |
|--------|------|-------|
| 4750 HP IVA a pagar | 1200,00€ | |
| 572000 Banc | | 1200,00€ |

---

## 7. INFORMES COMPTABLES

### 7.1 Llibre Diari

**Definició:** Registre cronològic de tots els assentaments.

**Codi amb Strapi ORM:**

```javascript
// services/reports.js
async generateDiary(fiscalYearId) {
  const entries = await strapi.query('journal-entry').find({
    fiscal_year: fiscalYearId,
    state: 'POSTED',
    _sort: 'date:ASC,number:ASC',
    _limit: -1
  }, [
    'journal',
    'lines',
    'lines.account',
    'lines.contact'
  ]);
  
  const diaryData = [];
  
  for (const entry of entries) {
    for (const line of entry.lines.sort((a, b) => a.sequence - b.sequence)) {
      diaryData.push({
        number: entry.number,
        date: entry.date,
        journal: entry.journal.name,
        concept: entry.concept,
        account_code: line.account.code,
        account_name: line.account.name,
        label: line.label,
        debit: line.debit,
        credit: line.credit,
        contact_name: line.contact ? line.contact.name : null
      });
    }
  }
  
  return diaryData;
}
```

**Format sortida:**

```
============================================
           LLIBRE DIARI 2026
============================================

Assentament: VT/2026/0001
Data: 15/01/2026
Diari: Vendes
Concepte: Factura F-2026-001 - Client ABC

  430000  Clients                     121,00€         -
  700000  Vendes                           -    100,00€
  477000  HP IVA repercutit                -     21,00€
                                      -------    -------
  TOTAL                               121,00€    121,00€

--------------------------------------------
```

### 7.2 Llibre Major

**Definició:** Moviments i saldo d'un compte específic.

**Codi amb Strapi ORM:**

```javascript
// services/reports.js
async generateLedger(accountId, fiscalYearId) {
  const lines = await strapi.query('journal-entry-line').find({
    account: accountId,
    _limit: -1
  }, ['journal_entry', 'journal_entry.fiscal_year']);
  
  // Filtrar per exercici i estat
  const filteredLines = lines.filter(line => 
    line.journal_entry.fiscal_year.id === fiscalYearId &&
    line.journal_entry.state === 'POSTED'
  );
  
  // Ordenar per data i número
  filteredLines.sort((a, b) => {
    const dateCompare = new Date(a.journal_entry.date) - new Date(b.journal_entry.date);
    if (dateCompare !== 0) return dateCompare;
    return a.journal_entry.number.localeCompare(b.journal_entry.number);
  });
  
  // Calcular saldo acumulat
  let runningBalance = 0;
  const ledgerData = filteredLines.map(line => {
    runningBalance += (line.debit - line.credit);
    
    return {
      date: line.journal_entry.date,
      number: line.journal_entry.number,
      concept: line.journal_entry.concept,
      label: line.label,
      debit: line.debit,
      credit: line.credit,
      balance: runningBalance
    };
  });
  
  return ledgerData;
}
``Codi amb Strapi ORM:**

```javascript
// services/reports.js
async generateTrialBalance(fiscalYearId) {
  // Obtenir tots els comptes
  const accounts = await strapi.query('accounting-account').find({
    _limit: -1,
    _sort: 'code:ASC'
  });
  
  // Obtenir totes les línies de l'exercici
  const lines = await strapi.query('journal-entry-line').find({
    _limit: -1
  }, ['account', 'journal_entry', 'journal_entry.fiscal_year']);
  
  // Filtrar línies per exercici i estat
  const filteredLines = lines.filter(line => 
    line.journal_entry.fiscal_year.id === fiscalYearId &&
    line.journal_entry.state === 'POSTED'
  );
  
  // Agrupar per compte
  const balanceData = accounts.map(account => {
    const accountLines = filteredLines.filter(line => line.account.id === account.id);
    
    const totalDebit = accountLines.reduce((sum, line) => sum + parseFloat(line.debit || 0), 0);
    const totalCredit = accountLines.reduce((sum, line) => sum + parseFloat(line.credit || 0), 0);
    const balance = totalDebit - totalCredit;
    
    return {
      code: account.code,
      name: account.name,
      type: account.type,
      total_debit: totalDebit,
      total_credit: totalCredit,
      balance: balance
    };
  });
  
  // Filtrar només comptes amb moviments
  return balanceData.filter(item => item.total_debit !== 0 || item.total_credit !== 0);
}e Sumes i Saldos

**Definició:** Resum de moviments i saldos de tots els comptes.

**Query SQL:**

```sql
SELECT 
  aa.code,
  aa.name,
  aa.type,
  COALESCE(SUM(jel.debit), 0) as total_debit,
  COALESCE(SUM(jel.credit), 0) as total_credit,
  COALESCE(SUM(jel.debit - jel.credit), 0) as balance
FROM accounting_accounts aa
LEFT JOIN journal_entry_lines jel ON jel.account = aa.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry
  AND je.fiscal_year = ?
  AND je.state = 'POSTED'
GROUP BY aa.id
HAVING total_debit != 0 OR total_credit != 0
ORCodi amb Strapi ORM:**

```javascript
// services/reports.js
async generateIncomeStatement(fiscalYearId) {
  // Obtenir comptes de despeses (6) i ingressos (7)
  const accounts = await strapi.query('accounting-account').find({
    _limit: -1
  });
  
  const expenseAccounts = accounts.filter(acc => acc.code.startsWith('6'));
  const incomeAccounts = accounts.filter(acc => acc.code.startsWith('7'));
  
  // Obtenir línies de l'exercici
  const lines = await strapi.query('journal-entry-line').find({
    _limit: -1
  }, ['account', 'journal_entry', 'journal_entry.fiscal_year']);
  
  const filteredLines = lines.filter(line => 
    line.journal_entry.fiscal_year.id === fiscalYearId &&
    line.journal_entry.state === 'POSTED'
  );
  
  // Calcular ingressos (crèdit - dèbit)
  const incomeData = incomeAccounts.map(account => {
    const accountLines = filteredLines.filter(line => line.account.id === account.id);
    const amount = accountLines.reduce((sum, line) => 
      sum + parseFloat(line.credit || 0) - parseFloat(line.debit || 0), 0
    );
    
    return {
      group_code: '7',
      group_name: 'INGRESSOS',
      code: account.code,
      name: account.name,
      amount: amount
    };
  }).filter(item => item.amount !== 0);
  
  // Calcular despeses (dèbit - crèdit)
  const expenseData = expenseAccounts.map(account => {
    const accountLines = filteredLines.filter(line => line.account.id === account.id);
    const amount = accountLines.reduce((sum, line) => 
      sum + parseFloat(line.debit || 0) - parseFloat(line.credit || 0), 0
    );
    
    return {
      group_code: '6',
      group_name: 'DESPESES',
      code: account.code,
      name: account.name,
      amount: amount
    };
  }).filter(item => item.amount !== 0);
  
  // Combinar i ordenar
  const allData = [...incomeData, ...expenseData].sort((a, b) => {
    if (a.group_code !== b.group_code) {
      return b.group_code.localeCompare(a.group_code); // 7 abans que 6
    }
    return a.code.localeCompare(b.code);
  });
  
  // Calcular totals
  const totalIncome = incomeData.reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = expenseData.reduce((sum, item) => sum + item.amount, 0);
  const result = totalIncome - totalExpense;
  
  return {
    items: allData,
  Codi amb Strapi ORM:**

```javascript
// services/reports.js
async generateBalanceSheet(fiscalYearId) {
  // Obtenir comptes dels grups 1-5
  const accounts = await strapi.query('accounting-account').find({
    _limit: -1
  });
  
  const balanceAccounts = accounts.filter(acc => {
    const firstChar = acc.code.charAt(0);
    return ['1', '2', '3', '4', '5'].includes(firstChar);
  });
  
  // Obtenir línies de l'exercici
  const lines = await strapi.query('journal-entry-line').find({
    _limit: -1
  }, ['account', 'journal_entry', 'journal_entry.fiscal_year']);
  
  const filteredLines = lines.filter(line => 
    line.journal_entry.fiscal_year.id === fiscalYearId &&
    line.journal_entry.state === 'POSTED'
  );
  
  // Calcular saldos per compte
  const balanceData = balanceAccounts.map(account => {
    const accountLines = filteredLines.filter(line => line.account.id === account.id);
    const balance = accountLines.reduce((sum, line) => 
      sum + parseFloat(line.debit || 0) - parseFloat(line.credit || 0), 0
    );
    
    // Classificar el compte
    let groupName;
    const firstChar = account.code.charAt(0);
    
    if (firstChar === '1') {
      groupName = 'Patrimoni net';
    } else if (firstChar === '2') {
      groupName = 'Actiu no corrent';
    } else if (firstChar === '3') {
      groupName = 'Actiu corrent - Existències';
    } else if (firstChar === '4') {
      groupName = account.type === 'ASSET' 
        ? 'Actiu corrent - Realitzable' 
        : 'Passiu corrent';
    } else if (firstChar === '5') {
      groupName = account.type === 'ASSET' 
        ? 'Actiu corrent - Disponible' 
        : 'Passiu corrent';
    }
    
    return {
      group_name: groupName,
      code: account.code,
      name: account.name,
      balance: balance
    };
  }).filter(item => item.balance !== 0);
  
  // Ordenar per codi
  balanceData.sort((a, b) => a.code.localeCompare(b.code));
  
  // Agrupar per tipus
  const assets = balanceData.filter(item => 
    item.group_name.includes('Actiu')
  );
  
  const liabilities = balanceData.filter(item => 
    item.group_name.includes('Passiu')
  );
  
  const equity = balanceData.filter(item => 
    item.group_name.includes('Patrimoni')
  );
  
  return {
    items: balanceData,
    assets,
    liabilities,
    equity,
    totalAssets: assets.reduce((sum, item) => sum + item.balance, 0),
    totalLiabilities: liabilities.reduce((sum, item) => sum + Math.abs(item.balance), 0),
    totalEquity: equity.reduce((sum, item) => sum + Math.abs(item.balance), 0)
  };
}KE '6%'
  AND je.fiscal_year = ?
  AND je.state = 'POSTED'
GROUP BY aa.id

ORDER BY group_code DESC, code
```

**Format sortida:**

```
============================================
    COMPTE DE PÈRDUES I GUANYS 2026
============================================
Codi amb Strapi ORM:**

```javascript
// services/reports.js
async generateVATSummary(fiscalYearId, quarter) {
  // Obtenir comptes d'IVA
  const vatCollectedAccount = await strapi.query('accounting-account')
    .findOne({ code: '477000' });
  
  const vatPaidAccounts = await strapi.query('accounting-account').find({
    code_in: ['472000', '472100']
  });
  
  const vatPaidAccountIds = vatPaidAccounts.map(acc => acc.id);
  
  // Obtenir any fiscal
  const fiscalYear = await strapi.query('year').findOne({ id: fiscalYearId });
  
  // Obtenir totes les línies d'IVA
  const lines = await strapi.query('journal-entry-line').find({
    _limit: -1,
    tax_line: true
  }, ['account', 'journal_entry', 'journal_entry.fiscal_year']);
  
  // Filtrar per exercici i estat
  const filteredLines = lines.filter(line => 
    line.journal_entry.fiscal_year.id === fiscalYearId &&
    line.journal_entry.state === 'POSTED'
  );
  
  // Funció per calcular trimestre
  const getQuarter = (dateString) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1; // 1-12
    return Math.ceil(month / 3);
  };
  
  // IVA Repercutit (cobrat)
  const vatCollected = filteredLines
    .filter(line => 
      line.account.id === vatCollectedAccount.id &&
      getQuarter(line.journal_entry.date) === quarter
    )
    .map(line => ({
      quarter: getQuarter(line.journal_entry.date),
      month: new Date(line.journal_entry.date).getMonth() + 1,
      date: line.journal_entry.date,
      number: line.journal_entry.number,
      concept: line.journal_entry.concept,
      base: line.tax_base_amount || 0,
      vat_amount: line.credit || 0
    }));
  
  // IVA Suportat (pagat)
  const vatPaid = filteredLines
    .filter(line => 
      vatPaidAccountIds.includes(line.account.id) &&
      getQuarter(line.journal_entry.date) === quarter
    )
    .map(line => ({
      quarter: getQuarter(line.journal_entry.date),
      month: new Date(line.journal_entry.date).getMonth() + 1,
      date: line.journal_entry.date,
      number: line.journal_entry.number,
      concept: line.journal_entry.concept,
      base: line.tax_base_amount || 0,
      vat_amount: line.debit || 0
    }));
  
  // Calcular totals
  const totalBaseCollected = vatCollected.reduce((sum, item) => sum + parseFloat(item.base), 0);
  const totalVatCollected = vatCollected.reduce((sum, item) => sum + parseFloat(item.vat_amount), 0);
  
  const totalBasePaid = vatPaid.reduce((sum, item) => sum + parseFloat(item.base), 0);
  const totalVatPaid = vatPaid.reduce((sum, item) => sum + parseFloat(item.vat_amount), 0);
  
  const vatToPay = totalVatCollected - totalVatPaid;
  
  return {
    fiscalYear: fiscalYear.year,
    quarter,
    vatCollected,
    vatPaid,
    summary: {
      totalBaseCollected,
      totalVatCollected,
      totalBasePaid,
      totalVatPaid,
      vatToPay
    }
  };
} LIKE '5%' AND aa.type = 'LIABILITY' THEN 'Passiu corrent'
  END as group_name,
  aa.code,
  aa.name,
  COALESCE(SUM(jel.debit - jel.credit), 0) as balance
FROM accounting_accounts aa
LEFT JOIN journal_entry_lines jel ON jel.account = aa.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry
  AND je.fiscal_year = ?
  AND je.state = 'POSTED'
WHERE aa.code REGEXP '^[1-5]'
GROUP BY aa.id
HAVING balance != 0
ORDER BY aa.code
```

**Format sortida:**

```
============================================
        BALANÇ DE SITUACIÓ 2026
============================================

ACTIU
  ACTIU NO CORRENT
    210000  Construccions               100.000,00€
    217000  Equips informàtics           10.000,00€
    (281000) Amortització acumulada     (20.000,00€)
                                        -----------
    TOTAL ACTIU NO CORRENT               90.000,00€

  ACTIU CORRENT
    430000  Clients                       5.000,00€
    572000  Banc                         15.000,00€
                                        -----------
    TOTAL ACTIU CORRENT                  20.000,00€

  TOTAL ACTIU                           110.000,00€

============================================

PASSIU I PATRIMONI NET
  PATRIMONI NET
    100000  Capital social               50.000,00€
    129000  Resultat exercici            16.000,00€
                                        -----------
    TOTAL PATRIMONI NET                  66.000,00€

  PASSIU CORRENT
    400000  Proveïdors                    3.000,00€
    4751    HP Seguretat Social           1.000,00€
                                        -----------
    TOTAL PASSIU CORRENT                  4.000,00€

  TOTAL PASSIU I PN                     110.000,00€

============================================
```

### 7.6 Informe d'IVA (Trimestral)

**Per Model 303**

**Query SQL:**

```sql
-- IVA Repercutit (cobrat)
SELECT 
  QUARTER(je.date) as quarter,
  MONTH(je.date) as month,
  je.date,
  je.number,
  je.concept,
  jel.tax_base_amount as base,
  jel.credit as vat_amount
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry
JOIN accounting_accounts aa ON aa.id = jel.account
WHERE aa.code = '477000'
  AND je.fiscal_year = ?
  AND je.state = 'POSTED'
  AND QUARTER(je.date) = ?
ORDER BY je.date

-- IVA Suportat (pagat)
SELECT 
  QUARTER(je.date) as quarter,
  MONTH(je.date) as month,
  je.date,
  je.number,
  je.concept,
  jel.tax_base_amount as base,
  jel.debit as vat_amount
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry
JOIN accounting_accounts aa ON aa.id = jel.account
WHERE aa.code IN ('472000', '472100')
  AND je.fiscal_year = ?
  AND je.state = 'POSTED'
  AND QUARTER(je.date) = ?
ORDER BY je.date
```

**Format sortida (Model 303):**

```
============================================
      MODEL 303 - 1T 2026
============================================

IVA REPERCUTIT (vendes)
  Base imposable:              10.000,00€
  IVA 21%:                      2.100,00€
  IVA 10%:                        500,00€
                               -----------
  TOTAL IVA REPERCUTIT:         2.600,00€

IVA SUPORTAT (compres)
  Base imposable:               5.000,00€
  IVA deduïble:                 1.000,00€
                               -----------
  TOTAL IVA SUPORTAT:           1.000,00€

============================================
  IVA A INGRESSAR (o devolució):  1.600,00€
============================================
```

---

## 8. RECONCILIACIÓ BANCÀRIA

### 8.1 Model: Bank Reconciliation

**Nou model (opcional, fase 7): `bank-reconciliation`**

```json
{
  "collectionName": "bank_reconciliations",
  "attributes": {
    "bank_account": {
      "model": "bank-accounts",
      "required": true
    },
    "date": {
      "type": "date",
      "required": true
    },
    "statement_balance": {
      "type": "decimal",
      "required": true,
      "description": "Saldo segons extracte bancari"
    },
    "computed_balance": {
      "type": "decimal",
      "description": "Saldo calculat de comptabilitat"
    },
    "difference": {
      "type": "decimal"
    },
    "reconciled": {
      "type": "boolean",
      "default": false
    }
  }
}
```

### 8.2 Flux de reconciliació

1. **Importar extracte bancari** (CSV/OFX/Excel)
2. **Obtenir moviments comptables** del compte 572XXX
3. **Comparar i matching automàtic** per import i data
4. **Marcar línies reconciliades**
5. **Identificar diferències:**
   - Moviments bancaris sense registre comptable (error o despesa no registrada)
   - Moviments comptables no reflectits al banc (xecs pendents, transferències en trànsit)

---

## 9. FASES D'IMPLEMENTACIÓ

### FASE 1: INFRAESTRUCTURA BÀSICA ⏱️ 2-3 setmanes

#### Tasques:
1. ✅ Crear models Strapi:
   - `accounting-journal`
   - `accounting-account`
   - `journal-entry`
   - `journal-entry-line`
   - `tax-config`
2. ✅ Modificar model `year` → afegir `start_date`, `end_date`, `closed`
3. ✅ Script d'importació del PGC bàsic (200-300 comptes)
4. ✅ Crear diaris comptables predefinits (seed)
5. ✅ Configurar tipus d'IVA amb comptes associats (seed)
6. ✅ Crear comptes auxiliars per cada `contact` (clients/proveïdors)
7. ✅ Crear comptes auxiliars per cada `bank_account`

#### Lliurables:
- ✅ Models creats i migracions executades
- ✅ Base de dades amb estructura comptable
- ✅ Scripts seed executats correctament
- ✅ Documentació dels models

#### Criteris d'acceptació:
- Pla comptable importat amb mínim 50 comptes
- 8 diaris creats i funcionals
- Configuracions d'IVA correctes

---

### FASE 2: GENERACIÓ AUTOMÀTICA D'ASSENTAMENTS ⏱️ 3-4 setmanes

#### Tasques:
1. ✅ Crear servei `AccountingService`:
   - `createInvoiceEntry(invoice, type)`
   - `createPaymentEntry(document, type)`
   - `createPayrollEntry(payroll)`
   - `postEntry(entryId)` - valida i publica
   - `reverseEntry(entryId, reason)` - cancel·la
2. ✅ Implementar generació d'assentaments per:
   - Factures emeses (`emitted_invoice`)
   - Factures rebudes (`received_invoice`)
   - Despeses rebudes (`received_expense`)
   - Cobraments/pagaments
3. ✅ Lifecycle hooks als models existents
4. ✅ Validacions:
   - DEBE = HABER (tolerància ±0.01€)
   - Exercici obert
   - Comptes existents
   - Data dins exercici
   - Mínim 2 línies

#### Lliurables:
- ✅ Servei central `services/accounting.js`
- ✅ Lifecycle hooks implementats
- ✅ Tests unitaris (Jest)
- ✅ API endpoints:
  - `POST /accounting/journal-entries` (crear manual)
  - `POST /accounting/journal-entries/:id/post` (publicar)
  - `POST /accounting/journal-entries/:id/reverse` (revertir)

#### Criteris d'acceptació:
- Factures emeses generen assentaments correctes
- Cobraments/pagaments generen assentaments
- Validacions funcionen correctament
- Tests amb cobertura > 80%

---

### FASE 3: INTERFÍCIE D'USUARI ⏱️ 2-3 setmanes

#### Tasques:
1. ✅ Pàgines Vue.js:
   - Llistat d'assentaments (filtres, cerca)
   - Detall d'assentament (només lectura si POSTED)
   - Formulari d'assentament manual
   - Llibre diari (vista tabulada)
   - Llibre major per compte
2. ✅ Components reutilitzables:
   - `AccountingAccountPicker`
   - `JournalEntryForm`
   - `JournalEntryLineTable`
3. ✅ Vista de traçabilitat:
   - Des d'una factura → veure assentament
   - Des d'un assentament → veure document origen

#### Lliurables:
- ✅ Interfície completa de comptabilitat
- ✅ Navegació intuïtiva
- ✅ Disseny consistent amb l'ERP actual

#### Criteris d'acceptació:
- Es poden crear assentaments manuals
- Es pot consultar el llibre diari i major
- Traçabilitat bidireccional funcional

---

### FASE 4: INFORMES COMPTABLES ⏱️ 2 setmanes

#### Tasques:
1. ✅ Implementar API d'informes:
   - `/accounting/reports/diary` - Llibre diari
   - `/accounting/reports/ledger/:accountId` - Llibre major
   - `/accounting/reports/trial-balance` - Balanç sumes i saldos
   - `/accounting/reports/income-statement` - Pèrdues i guanys
   - `/accounting/reports/balance-sheet` - Balanç situació
   - `/accounting/reports/vat-summary` - Resum IVA
2. ✅ Interfície per visualitzar informes
3. ✅ Exportació a Excel (XLSX)
4. ✅ Exportació a PDF

#### Lliurables:
- ✅ Suite completa d'informes
- ✅ Generació de PDFs oficials
- ✅ Exportació Excel funcional

#### Criteris d'acceptació:
- Tots els informes generen dades correctes
- PDFs amb format professional
- Exportació Excel amb fórmules

---

### FASE 5: NÒMINES I IMPOSTOS ⏱️ 2 setmanes

#### Tasques:
1. ✅ Assentaments de nòmines (`payroll`)
   - Registre mensual
   - Pagament net
   - Pagament SS empresa/treballador
   - Pagament IRPF
2. ✅ Liquidació trimestral d'IVA
   - Càlcul automàtic (suma comptes 477 i 472)
   - Generació assentament de liquidació
   - Generació assentament de pagament
3. ✅ Model 303 (IVA trimestral)
   - Exportació a format AEAT

#### Lliurables:
- ✅ Comptabilització completa de nòmines
- ✅ Procediment de liquidació d'IVA
- ✅ Generació Model 303

#### Criteris d'acceptació:
- Nòmines generen assentaments correctes amb SS i IRPF
- Liquidació IVA automàtica funcional
- Model 303 exportable

---

### FASE 6: TANCAMENT D'EXERCICI ⏱️ 1-2 setmanes

#### Tasques:
1. ✅ Assentament de regularització (Grup 6 i 7 → 129)
2. ✅ Tancament d'exercici (marcar `closed = true`)
3. ✅ Assentament d'obertura següent exercici
4. ✅ Traspàs de saldos (Grups 1-5)
5. ✅ Validacions:
   - No permetre edicions en exercicis tancats
   - No permetre obrir exercicis tancats

#### Lliurables:
- ✅ Procediment de tancament automatitzat
- ✅ Generació de comptes anuals

#### Criteris d'acceptació:
- Exercici es pot tancar correctament
- Exercici següent s'obre amb saldos correctes
- No es poden crear assentaments en exercicis tancats

---

### FASE 7: RECONCILIACIÓ BANCÀRIA ⏱️ 1-2 setmanes (OPCIONAL)

#### Tasques:
1. ⚠️ Model de reconciliació
2. ⚠️ Importació d'extractes bancaris (CSV, OFX)
3. ⚠️ Matching automàtic per import/data
4. ⚠️ Interfície de reconciliació manual
5. ⚠️ Generació d'assentaments des d'extracte

#### Lliurables:
- ⚠️ Sistema de conciliació bancària funcional

---

### FASE 8: OPTIMITZACIONS I MILLORES ⏱️ Continu

#### Tasques:
1. ⚠️ Caché de saldos (materialized views)
2. ⚠️ Millores de rendiment (índexs, queries)
3. ⚠️ Auditoria avançada (log de canvis)
4. ⚠️ Dashboard comptable (gràfics, KPIs)
5. ⚠️ Integració amb SII (Subministrament Immediat d'Informació)
6. ⚠️ Model 390 (Resum anual IVA)

---

## 10. CONSIDERACIONS TÈCNIQUES

### 10.1 Validacions crítiques

```javascript
// services/accounting-validator.js
module.exports = {
  
  async validateJournalEntry(entryId) {
    const entry = await strapi.query('journal-entry')
      .findOne({ id: entryId }, ['lines', 'lines.account', 'fiscal_year']);
    
    // 1. DEBE = HABER
    const totalDebit = entry.lines.reduce((sum, l) => sum + parseFloat(l.debit), 0);
    const totalCredit = entry.lines.reduce((sum, l) => sum + parseFloat(l.credit), 0);
    entries = await strapi.query('journal-entry').find({
      journal: journalId,
      fiscal_year: fiscalYearId,
      _sort: 'number:DESC',
      _limit: 1
    });
    
    const lastEntry = entries.length > 0 ? entries[0] : null
    // 2. Mínim 2 línies
    if (entry.lines.length < 2) {
      throw new Error('Un assentament ha de tenir mínim 2 línies');
    }
    
    // 3. Exercici obert
    const year = await strapi.query('year')
      .findOne({ id: entry.fiscal_year.id });
    
    if (year.closed) {
      throw new Error('No es poden crear assentaments en exercicis tancats');
    }
    
    // 4. Data dins l'exercici
    const entryDate = new Date(entry.date);
    const startDate = new Date(year.start_date);
    const endDate = new Date(year.end_date);
    
    if (entryDate < startDate || entryDate > endDate) {
      throw new Error(`Data ${entry.date} fora de l'exercici fiscal ${year.year}`);
    }
    
    // 5. Comptes existents i no deprecated
    for (const line of entry.lines) {
      if (line.account.deprecated) {
        throw new Error(`El compte ${line.account.code} està obsolet`);
      }
    }
    
    return true;
  }
  
};
```

### 10.2 Generació de números d'assentament

```javascript
// services/accounting-sequence.js
module.exports = {
  
  async getNextEntryNumber(journalId, fiscalYearId) {
    const journal = await strapi.query('accounting-journal')
      .findOne({ id: journalId });
    
    const year = await strapi.query('year')
      .findOne({ id: fiscalYearId });
    
    // Obtenir últim assentament d'aquest diari/exercici
    const lastEntry = await strapi.connections.default
      .from('journal_entries')
      .where({ journal: journalId, fiscal_year: fiscalYearId })
      .orderBy('number', 'desc')
      .first();
    
    const prefix = journal.sequence_prefix || journal.code;
    
    let sequence = 1;
    if (lastEntry) {
      // Extreure número de format "VT/2026/0001"
      const parts = lastEntry.number.split('/');
      if (parts.length === 3) {
        sequence = parseInt(parts[2]) + 1;
      }
    }
    
    return `${prefix}/${year.year}/${sequence.toString().padStart(4, '0')}`;
    // Exemple: VT/2026/0001
  }
  
};
```

### 10.3 Servei central de comptabilitat

```javascript
// services/accounting.js
const validator = require('./accounting-validator');
const sequence = require('./accounting-sequence');

module.exports = {
  
  /**
   * Crear assentament des d'una factura
   */
  async createInvoiceEntry(invoice, type) {
    // type: 'sale' | 'purchase'
    
    const journalCode = type === 'sale' ? 'VT' : 'CO';
    const journal = await strapi.query('accounting-journal')
      .findOne({ code: journalCode });
    
    const year = await this.getFiscalYear(invoice.emitted);
    
    // Crear assentament
    const number = await sequence.getNextEntryNumber(journal.id, year.id);
    
    const entry = await strapi.query('journal-entry').create({
      number,
      fiscal_year: year.id,
      journal: journal.id,
      date: invoice.emitted,
      reference: invoice.code,
      concept: `Factura ${invoice.code} - ${invoice.contact.name}`,
      source_model: type === 'sale' ? 'emitted-invoice' : 'received-invoice',
      source_id: invoice.id,
      state: 'DRAFT'
    });
    
    // Crear línies segons tipus
    if (type === 'sale') {
      await this.createSaleInvoiceLines(entry.id, invoice);
    } else {
      await this.createPurchaseInvoiceLines(entry.id, invoice, year);
    }
    
    // Validar i publicar automàticament
    await validator.validateJournalEntry(entry.id);
    await this.postEntry(entry.id);
    
    return entry;
  },
  
  /**
   * Crear línies per factura de venda
   */
  async createSaleInvoiceLines(entryId, invoice) {
    let sequence = 1;
    
    // Compte client
    const clientAccount = await this.getClientAccount(invoice.contact);
    
    // Línia client (DEBE)
    await strapi.query('journal-entry-line').create({
      journal_entry: entryId,
      sequence: sequence++,
      account: clientAccount.id,
      label: `Client ${invoice.contact.name}`,
      debit: invoice.total,
      credit: 0,
      contact: invoice.contact.id
    });
    
    // Línia vendes (HABER)
    const salesAccount = await strapi.query('accounting-account')
      .findOne({ code: '700000' });
    
    await strapi.query('journal-entry-line').create({
      journal_entry: entryId,
      sequence: sequence++,
      account: salesAccount.id,
      label: `Factura ${invoice.code}`,
      debit: 0,
      credit: invoice.total_base
    });
    
    // Línia IVA (HABER)
    if (invoice.total_vat > 0) {
      const vatAccount = await strapi.query('accounting-account')
        .findOne({ code: '477000' });
      
      await strapi.query('journal-entry-line').create({
        journal_entry: entryId,
        sequence: sequence++,
        account: vatAccount.id,
        label: `IVA Factura ${invoice.code}`,
        debit: 0,
        credit: invoice.total_vat,
        tax_line: true,
        tax_base_amount: invoice.total_base
      });
    }
    
    // Línia IRPF si escau (DEBE)
    if (invoice.total_irpf > 0) {
      const irpfAccount = await strapi.query('accounting-account')
        .findOne({ code: '4750' });
      
      await strapi.query('journal-entry-line').create({
        journal_entry: entryId,
        sequence: sequence++,
        account: irpfAccount.id,
        label: `IRPF Factura ${invoice.code}`,
        debit: invoice.total_irpf,
        credit: 0,
        tax_line: true
      });
    }
  },
  
  /**
   * Crear línies per factura de compra
   */
  async createPurchaseInvoiceLines(entryId, invoice, year) {
    let sequence = 1;
    
    // Compte proveïdor
    const supplierAccount = await this.getSupplierAccount(invoice.contact);
    
    // Compte despesa
    const expenseAccount = await strapi.query('accounting-account')
      .findOne({ code: '600000' });
    
    // Gestió IVA deduïble
    const deductiblePct = year.deductible_vat_pct || 100;
    const deductibleVat = invoice.total_vat * (deductiblePct / 100);
    const nonDeductibleVat = invoice.total_vat - deductibleVat;
    
    // Línia despesa (DEBE) - inclou IVA no deduïble
    await strapi.query('journal-entry-line').create({
      journal_entry: entryId,
      sequence: sequence++,
      account: expenseAccount.id,
      label: `Factura ${invoice.code}`,
      debit: invoice.total_base + nonDeductibleVat,
      credit: 0
    });
    
    // Línia IVA deduïble (DEBE)
    if (deductibleVat > 0) {
      const vatCode = deductiblePct < 100 ? '472100' : '472000';
      const vatAccount = await strapi.query('accounting-account')
        .findOne({ code: vatCode });
      
      await strapi.query('journal-entry-line').create({
        journal_entry: entryId,
        sequence: sequence++,
        account: vatAccount.id,
**Nota:** Strapi gestiona automàticament molts índexs, però es poden afegir índexs personalitzats si cal.

**Camps que es beneficien d'índexs:**

```javascript
// Els índexs es poden definir a les migracions de Strapi o directament a la BD

// journal_entries:
// - fiscal_year (ja indexat per ser FK)
// - date (afegir si hi ha molts registres)
// - state (afegir per filtres freqüents)
// - source_model + source_id (per traçabilitat)

// journal_entry_lines:
// - journal_entry (ja indexat per ser FK)
// - account (ja indexat per ser FK)
// - contact (ja indexat per ser FK)

// accounting_accounts:
// - code (afegir UNIQUE index)
// - contact (ja indexat per ser FK)

// Exemple de migració manual si cal (knex):
/*
exports.up = async function(knex) {
  await knex.schema.alterTable('journal_entries', (table) => {
    table.index('date', 'idx_je_date');
    table.index('state', 'idx_je_state');
    table.index(['source_model', 'source_id'], 'idx_je_source');
  });
};
*/
```

**Recomanacions:**
- Strapi crea automàticament índexs per claus foranes (FK)
- Només cal afegir índexs manuals si hi ha problemes de rendiment
- Usar `_limit: -1` amb precaució en taules grans
- Considerar paginació per informes amb molts registres   credit: invoice.total,
      contact: invoice.contact.id
    });
  },
  
  /**
   * Publicar assentament (immutable)
   */
  async postEntry(entryId, userId) {
    await validator.validateJournalEntry(entryId);
    
    await strapi.query('journal-entry').update(
      { id: entryId },
      {
        state: 'POSTED',
        posted_date: new Date(),
        posted_by: userId
      }
    );Caché de saldos per rendiment (opcional)

**Nota:** Només implementar si hi ha problemes de rendiment amb més de 10.000 assentaments.

**Opció 1: Taula de caché amb Strapi**

```javascript
// Crear model: account-balance-cache
{
  "collectionName": "account_balance_cache",
  "attributes": {
    "account": { "model": "accounting-account", "required": true },
    "fiscal_year": { "model": "year", "required": true },
    "total_debit": { "type": "decimal", "default": 0 },
    "total_credit": { "type": "decimal", "default": 0 },
    "balance": { "type": "decimal", "default": 0 },
    "last_movement_date": { "type": "date" },
    "movement_count": { "type": "integer", "default": 0 }
  }
}

// Servei per actualitzar caché
async function refreshAccountBalanceCache(fiscalYearId) {
  const accounts = await strapi.query('accounting-account').find({ _limit: -1 });
  
  for (const account of accounts) {
    const lines = await strapi.query('journal-entry-line').find({
      account: account.id,
      _limit: -1
    }, ['journal_entry', 'journal_entry.fiscal_year']);
    
    const fiscalYearLines = lines.filter(line => 
      line.journal_entry.fiscal_year.id === fiscalYearId &&
      line.journal_entry.state === 'POSTED'
    );
    
    const totalDebit = fiscalYearLines.reduce((sum, l) => sum + parseFloat(l.debit || 0), 0);
    const totalCredit = fiscalYearLines.reduce((sum, l) => sum + parseFloat(l.credit || 0), 0);
    const balance = totalDebit - totalCredit;
    
    const lastDate = fiscalYearLines.length > 0 
      ? fiscalYearLines.sort((a, b) => 
          new Date(b.journal_entry.date) - new Date(a.journal_entry.date)
        )[0].journal_entry.date 
      : null;
    
    // Actualitzar o crear caché
    const existing = await strapi.query('account-balance-cache').findOne({
      account: account.id,
      fiscal_year: fiscalYearId
    });
    
    const cacheData = {
      account: account.id,
      fiscal_year: fiscalYearId,
      total_debit: totalDebit,
      total_credit: totalCredit,
      balance: balance,
      last_movement_date: lastDate,
      movement_count: fiscalYearLines.length
    };
    
    if (existing) {
      await strapi.query('account-balance-cache').update({ id: existing.id }, cacheData);
    } else {
      await strapi.query('account-balance-cache').create(cacheData);
    }
  }
}

// Executar després de publicar assentaments
// await refreshAccountBalanceCache(fiscalYearId);
```

**Opció 2: Redis/Memory Cache (més ràpid)**

```javascript
// Usar un sistema de caché extern com Redis
// Només per volums molt alts (>50.000 assentaments/any)
const Redis = require('ioredis');
const redis = new Redis();

async function getCachedAccountBalance(accountId, fiscalYearId) {
  const cacheKey = `balance:${accountId}:${fiscalYearId}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Calcular i guardar a caché
  const balance = await calculateAccountBalance(accountId, fiscalYearId);
  await redis.set(cacheKey, JSON.stringify(balance), 'EX', 3600); // 1h
  
  return balance;
}
```

**Recomanació inicial:** No implementar caché fins que sigui necessari. L'ORM de Strapi és prou ràpid per la majoria de casos.   journal: original.journal,
      date: new Date(),
      concept: `Anulació: ${original.concept} - ${reason}`,
      reversal_of: original.id,
      state: 'DRAFT'
    });
    
    // Crear línies inverses (DEBE ↔ HABER)
    for (const line of original.lines) {
      await strapi.query('journal-entry-line').create({
        journal_entry: reversal.id,
        sequence: line.sequence,
        account: line.account.id,
        label: `Anulació: ${line.label}`,
        debit: line.credit,  // INVERTIT
        credit: line.debit,  // INVERTIT
        contact: line.contact
      });
    }
    
    await this.postEntry(reversal.id, userId);
    
    // Marcar original com cancel·lat
    await strapi.query('journal-entry').update(
      { id: original.id },
      { state: 'CANCELLED' }
    );
    
    return reversal;
  },
  
  /**
   * Obtenir exercici fiscal per una data
   */
  async getFiscalYear(date) {
    const dateObj = new Date(date);
    const year = dateObj.getFullYear();
    
    return await strapi.query('year').findOne({
      year,
      closed: false
    });
  },
  
  /**
   * Obtenir compte auxiliar d'un client
   */
  async getClientAccount(contact) {
    // Buscar compte auxiliar existent
    let account = await strapi.query('accounting-account')
      .findOne({ contact: contact.id });
    
    if (!account) {
      // Crear compte auxiliar nou
      const code = `4300${String(contact.id).padStart(3, '0')}`;
      account = await strapi.query('accounting-account').create({
        code,
        name: contact.name,
        type: 'ASSET',
        level: 2,
        reconcile: true,
        contact: contact.id,
        parent: (await strapi.query('accounting-account').findOne({ code: '430000' })).id
      });
    }
    
    return account;
  },
  
  /**
   * Obtenir compte auxiliar d'un proveïdor
   */
  async getSupplierAccount(contact) {
    let account = await strapi.query('accounting-account')
      .findOne({ contact: contact.id });
    
    if (!account) {
      const code = `4000${String(contact.id).padStart(3, '0')}`;
      account = await strapi.query('accounting-account').create({
        code,
        name: contact.name,
        type: 'LIABILITY',
        level: 2,
        reconcile: true,
        contact: contact.id,
        parent: (await strapi.query('accounting-account').findOne({ code: '400000' })).id
      });
    }
    
    return account;
  }
  
};
```

### 10.4 Índexs de base de dades

```sql
-- Índexs per rendiment
CREATE INDEX idx_je_fiscal_year ON journal_entries(fiscal_year);
CREATE INDEX idx_je_date ON journal_entries(date);
CREATE INDEX idx_je_state ON journal_entries(state);
CREATE INDEX idx_je_journal ON journal_entries(journal);
CREATE INDEX idx_je_source ON journal_entries(source_model, source_id);

CREATE INDEX idx_jel_entry ON journal_entry_lines(journal_entry);
CREATE INDEX idx_jel_account ON journal_entry_lines(account);
CREATE INDEX idx_jel_contact ON journal_entry_lines(contact);

CREATE INDEX idx_aa_code ON accounting_accounts(code);
CREATE INDEX idx_aa_type ON accounting_accounts(type);
CREATE INDEX idx_aa_contact ON accounting_accounts(contact);
```

### 10.5 Materialized views per rendiment (opcional)

```sql
-- Vista de saldos per compte (refrescar diàriament)
CREATE MATERIALIZED VIEW account_balances AS
SELECT 
  aa.id as account_id,
  aa.code,
  aa.name,
  aa.type,
  je.fiscal_year,
  COALESCE(SUM(jel.debit), 0) as total_debit,
  COALESCE(SUM(jel.credit), 0) as total_credit,
  COALESCE(SUM(jel.debit - jel.credit), 0) as balance,
  MAX(je.date) as last_movement_date,
  COUNT(jel.id) as movement_count
FROM accounting_accounts aa
LEFT JOIN journal_entry_lines jel ON jel.account = aa.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry
WHERE je.state = 'POSTED'
GROUP BY aa.id, je.fiscal_year;

-- Refrescar cada nit o després de publicar assentaments
-- REFRESH MATERIALIZED VIEW account_balances;
```

---

## RESUM EXECUTIU

### Models nous a crear:

1. ✅ **accounting-journal** (Diaris comptables)
2. ✅ **accounting-account** (Pla comptable PGC)
3. ✅ **journal-entry** (Assentaments)
4. ✅ **journal-entry-line** (Línies d'assentament)
5. ✅ **tax-config** (Configuració d'impostos)
6. ⚠️ **bank-reconciliation** (Opcional, fase 7)

### Models a modificar:

1. ✅ **year** → Afegir `start_date`, `end_date`, `closed`, `closed_date`, `closed_by`
2. ⚠️ Considerar migrar `vat-type` a `tax-config` (o conviure)

### Serveis a implementar:

1. ✅ **AccountingService** - Lògica central de comptabilitat
2. ✅ **AccountingValidator** - Validacions d'assentaments
3. ✅ **AccountingSequence** - Generació de números
4. ✅ **ReportService** - Generació d'informes

### API Endpoints nous:

```
GET    /accounting/journal-entries
POST   /accounting/journal-entries
GET    /accounting/journal-entries/:id
POST   /accounting/journal-entries/:id/post
POST   /accounting/journal-entries/:id/reverse
DELETE /accounting/journal-entries/:id (només DRAFT)

GET    /accounting/accounts
POST   /accounting/accounts
GET    /accounting/accounts/:id
PUT    /accounting/accounts/:id

GET    /accounting/reports/diary?year=2026
GET    /accounting/reports/ledger/:accountId?year=2026
GET    /accounting/reports/trial-balance?year=2026
GET    /accounting/reports/income-statement?year=2026
GET    /accounting/reports/balance-sheet?year=2026
GET    /accounting/reports/vat-summary?year=2026&quarter=1

POST   /accounting/fiscal-year/:id/close
```

### Prioritats:

1. **ALTA (imprescindible)**: Fases 1-2 (infraestructura + assentaments automàtics)
2. **MITJA (important)**: Fases 3-5 (UI + informes + nòmines)
3. **BAIXA (opcional)**: Fases 6-7 (tancament + reconciliació)

### Temps estimat:

- **MVP funcional**: 8-10 setmanes (Fases 1-3)
- **Sistema complet**: 14-16 setmanes (Fases 1-6)
- **Amb reconciliació**: 16-18 setmanes (Fases 1-7)

### Riscos identificats:

1. ⚠️ Complexitat de la doble partida (requereix formació)
2. ⚠️ Migracions de dades existents (factures antigues)
3. ⚠️ Rendiment amb grans volums de dades (>10.000 assentaments/any)
4. ⚠️ Normativa AEAT canviant (SII, models)

### Recomanacions:

1. ✅ Començar amb exercici nou (2026 o 2027)
2. ✅ No migrar comptabilitat d'exercicis anteriors (opcional)
3. ✅ Formar usuaris en conceptes bàsics de comptabilitat
4. ✅ Validar amb assessor fiscal/comptable
5. ✅ Implementar per fases, validant cada fase abans de continuar

---

**Última actualització:** 18 maig 2026  
**Autor:** GitHub Copilot  
**Versió:** 1.0

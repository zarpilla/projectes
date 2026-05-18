Per començar un mòdul de comptabilitat dins d’un ERP a Espanya, el millor és separar-ho en 3 capes:

Model comptable (assentaments, comptes, DEBE/HABER)
Lògica fiscal espanyola (IVA, sèries, exercicis, impostos)
Operativa ERP (factures, cobraments, conciliació, informes)

A Espanya la base és el Instituto de Contabilidad y Auditoría de Cuentas i el PGC (Pla General Comptable).

1. El concepte clau: el “llibre diari”

Tot gira al voltant dels assentaments comptables.

Cada operació genera un assentament

Data	Compte	Concepte	DEBE	HABER
01/05	430 Clients	Factura client	121 €	
01/05	700 Vendes	Base factura		100 €
01/05	477 IVA repercutit	IVA 21%		21 €

La regla és:

La suma del DEBE ha de ser igual a la suma del HABER.

Això és el nucli del sistema.

2. Arquitectura mínima recomanada

Per un ERP senzill, jo faria aquestes entitats:

Exercici comptable
FiscalYear -> Lligat a "year" existent
- id
- year
- start_date
- end_date
- closed


Exemple:

2026 → 01/01/2026 - 31/12/2026
Pla comptable

Basat en el PGC espanyol.

Account
- id
- code
- name
- type
- active

Exemples:

Codi	Nom
4300001	Client X
4000001	Proveïdor Y
700000	Vendes
600000	Compres
572000	Banc
477000	IVA repercutit
472000	IVA suportat

Els tipus poden ser:

asset
liability
income
expense
equity
Assentament comptable
JournalEntry
- id
- fiscal_year_id
- date
- concept
- status (draft/posted)
- source_type
- source_id
- number

source_type/source_id és important:

invoice
payment
payroll
manual
amortization

Això permet traçabilitat.

Línies de l’assentament
JournalEntryLine
- id
- journal_entry_id
- account_id
- debit
- credit
- description

Restricció important:

SUM(debit) == SUM(credit)
3. Com es connecta amb la facturació

La factura NO és la comptabilitat.

La factura genera comptabilitat.

Exemple:

Invoice
- id
- customer_id
- total
- tax
- status

Quan:

es valida
es cobra
es rectifica

…es generen assentaments.

4. Flux bàsic que heu d’implementar primer
A. Factura emesa

Factura:

Base: 100
IVA: 21
Total: 121

Assentament:

Compte	DEBE	HABER
430 Clients	121	
700 Vendes		100
477 IVA repercutit		21
B. Cobro factura
Compte	DEBE	HABER
572 Banc	121	
430 Clients		121
C. Factura rebuda
Compte	DEBE	HABER
600 Compres	100	
472 IVA suportat	21	
400 Proveïdors		121

Amb això ja teniu:

llibre diari
llibre major
saldo clients
saldo proveïdors
IVA
5. El més important: NO guardar saldos

Error típic.

No guardeu:

saldo compte
saldo client
saldo IVA

Els saldos es calculen:

SUM(DEBE) - SUM(HABER)

Podeu fer caches/materialized views després.

La comptabilitat ha de ser:

immutable
auditable
recalculable
6. Necessitareu “journals”

Molt recomanable.

Journal
- SALES
- PURCHASES
- BANK
- CASH
- GENERAL

Cada assentament pertany a un diari.

7. Tema IVA a Espanya

Molt important.

Necessitareu:

Tipus IVA
21%
10%
4%
exempt
intracomunitari
inversió subjecte passiu

Taula:

Tax
- code
- rate
- type
- account_collected
- account_paid
8. Informes mínims

Primer objectiu:

Imprescindibles
Llibre diari
Llibre major
Balanç de sumes i saldos
Pèrdues i guanys
IVA repercutit / suportat

Després:

model 303
model 390
SII
amortitzacions
9. Restriccions importants

Quan un assentament està “posted”:

NO editar
NO esborrar

Només:

revertir
generar contrapunt

Això és fonamental en comptabilitat seriosa.
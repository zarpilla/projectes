# Com es tramita una factura a FACe

Aquest document explica, sense entrar en tecnicismes, **tot el que passa des que crees una factura fins que queda registrada a FACe** (el portal del govern espanyol per a facturació electrònica a administracions públiques).

> FACe = "Factura Electrónica". És la finestreta única on totes les administracions públiques reben les seves factures de proveïdors.

---

## 1. El punt de partida: emets una factura

Tu crees una factura emesa a un client com sempre. La diferència és quan aquest **client és una administració pública** (universitat, ajuntament, conselleria…).

Aquests clients tenen marcada la casella **"FACe"** a la seva fitxa de contacte i tenen tres codis especials anomenats **DIR3** (oficina comptable, òrgan gestor i unitat tramitadora). Aquests codis identifiquen exactament a qui ha d'arribar la factura dins de l'administració.

Tan bon punt **guardes la factura com a emesa**, el sistema sap que cal enviar-la a FACe i comença automàticament la tramitació.

---

## 2. Es crea una entrada a la "cua FACe"

El sistema no envia la factura immediatament a FACe. Primer crea un **registre a la cua** (una mena de "ordre de feina") amb:

- L'estat inicial: **"pendent"**.
- Quina factura cal enviar.
- Quin mode utilitza (`test` per a proves, `real` per a enviaments oficials).

Aquesta cua serveix per **no perdre cap factura**: encara que falli alguna cosa, la factura quedarà registrada esperant que es pugui enviar.

---

## 3. Es genera el document oficial (Facturae 3.2)

A partir de les dades de la factura, el sistema construeix un fitxer en format **Facturae 3.2**, que és l'únic format que FACe accepta. Aquest fitxer és un XML (un text estructurat) que inclou:

- **Emissor**: les teves dades fiscals (NIF, nom, adreça, província…).
- **Receptor**: les dades del client públic + els seus codis DIR3.
- **Línies de la factura**: concepte, quantitat, preu, IVA…
- **Totals**: base imposable, IVA, total, retencions…
- **Forma de pagament**: si hi ha compte bancari associat, s'inclou l'IBAN.

> Aquest fitxer és estricte: si falta un camp obligatori o un valor és massa llarg (per exemple, una província de més de 20 caràcters), FACe el rebutjarà.

---

## 4. Es firma digitalment amb el certificat

FACe no accepta cap factura que no estigui **firmada digitalment amb un certificat oficial** (FNMT o equivalent). La firma assegura que:

- La factura ve realment de tu (autoria).
- Ningú l'ha modificat pel camí (integritat).
- Té validesa legal davant l'administració.

El sistema agafa el certificat configurat (`face_certificate`), demana la contrasenya, i firma el document XML afegint-li un bloc de firma anomenat **XAdES-BES** amb la política de firma de Facturae.

> Si el certificat no està configurat o la contrasenya és incorrecta, la factura quedarà en estat **"error"** i no s'enviarà.

---

## 5. S'envia a FACe

Amb el document firmat, el sistema fa una crida a l'API de FACe (entorn de proves o real, segons el mode):

1. S'autentica utilitzant el mateix certificat (token JWT).
2. Envia la factura codificada.
3. Espera la resposta de FACe.

**Possibles resultats:**

| Resposta de FACe | Què significa | Estat a la cua |
|---|---|---|
| **200 OK** + número de registre (`REGAGE...`) | Acceptada i registrada | `registered` |
| **400 Bad Request** | El XML té un error (camp incorrecte, format invàlid…) | `pending` → reintent |
| **500 Server Error** | FACe està temporalment caigut o saturat | `pending` → reintent |
| **403 Forbidden** | El certificat no està autoritzat al portal d'Integradors | `pending` → reintent |

---

## 6. Sistema de reintents automàtics

FACe pot fallar puntualment (especialment en hores punta), però **uns minuts després pot funcionar perfectament**. Per això hi ha un sistema de reintents:

- Cada **5 minuts**, un procés revisa totes les factures en estat **"pendent"** que tenen el XML ja firmat però encara no s'han pogut enviar.
- Reintenta enviar-les **reutilitzant el document ja firmat** (no es regenera ni es torna a firmar — la signatura conserva la data original).
- Espera mínim **2 minuts** entre intent i intent per no martellar el servidor de FACe.
- Si una factura falla **10 vegades seguides**, passa a estat **"error"** i ja no es reintenta automàticament. En aquest cas, cal revisar-la manualment.

Això vol dir que, si FACe està caigut a les 22:00 quan emets la factura, **probablement quedarà registrada sola abans de mitjanit** sense que hagis de fer res.

---

## 7. Seguiment de l'estat a FACe

Un cop la factura té un **número de registre** (`REGAGE26e00000xxxxxx`), encara no està "lliurada" — només està registrada al sistema FACe a l'espera que l'administració destinatària la descarregui i la processi.

Per això hi ha un altre procés que, **cada 30 minuts**, pregunta a FACe l'estat actual de totes les factures registrades:

| Estat FACe | Estat a la cua | Significat |
|---|---|---|
| **REC01** (Entregada) | `delivered` | L'administració ja l'ha rebut |
| **REC02** (Rebutjada) | `rejected` | L'administració l'ha rebutjat (amb un motiu) |
| (sense canvi) | `registered` | Encara està en tràmit |

---

## Resum visual del flux complet

```
   Crees factura emesa amb client FACe
                 │
                 ▼
   ✅ Es crea registre a la "cua FACe" (pendent)
                 │
                 ▼
   ✅ Es genera el document Facturae 3.2 (XML)
                 │
                 ▼
   ✅ Es firma amb el certificat digital (XAdES-BES)
                 │
                 ▼
   📤 S'envia a FACe
                 │
        ┌────────┴────────┐
        ▼                 ▼
   ✅ Acceptada       ❌ Falla (500, 503...)
   (REGAGE...)            │
        │                 ▼
        │       ⏱ Reintent automàtic cada 5 min
        │           (fins a 10 intents)
        │                 │
        │                 ▼
        │            ✅ Acceptada
        ▼                 ▼
   🔄 Cada 30 min es comprova l'estat
                 │
        ┌────────┴────────┐
        ▼                 ▼
   📬 Entregada       ⚠️ Rebutjada
   (REC01)            (REC02 + motiu)
```

---

## Què has de fer tu, com a usuari?

**Cas normal (el 99% de les vegades):**

1. Emets la factura com sempre.
2. Esperes.
3. Al cap de pocs minuts (o hores, si FACe va lent), la factura apareix com a **registrada** amb un número `REGAGE...`.
4. Al cap d'unes hores o dies, l'administració la marca com a **entregada**.

**Casos en què cal intervenir:**

- **Factura en estat "error"**: el sistema no l'ha pogut enviar després de 10 intents. Revisa el motiu (camp incorrecte, certificat caducat, dades del client incompletes…) i corregeix-ho.
- **Factura "rebutjada"** per l'administració: revisa el motiu indicat per FACe i emet una rectificativa si cal.

---

## Estats possibles d'una factura a la cua FACe

| Estat | Què vol dir |
|---|---|
| `pending` | Esperant ser enviada o reintentar enviament |
| `registered` | Acceptada per FACe, esperant que l'administració la descarregui |
| `delivered` | L'administració ja l'ha rebut |
| `rejected` | L'administració l'ha rebutjat |
| `error` | Ha fallat 10 vegades i necessita revisió manual |

---

## Què cal tenir configurat perquè tot funcioni

- **Certificat digital** (.p12) carregat a la fitxa "Me" i amb la contrasenya correcta.
- **Certificat registrat al portal d'Integradors** de FACe (https://integradores.face.gob.es/).
- **Dades fiscals completes** del teu negoci: NIF, adreça, codi postal, **província** (màxim 20 caràcters).
- **Compte bancari per defecte** configurat (per al camp d'IBAN a la factura).
- **Clients públics ben configurats**: marcats com a FACe, amb els tres codis DIR3 (OC, OG, UT) i adreça vàlida.

---

## En cas de dubte

- **Estat de la factura**: a l'apartat de "Cua FACe" pots veure cada entrada, el seu estat, el nombre d'intents fets i la resposta exacta de FACe.
- **Suport oficial de FACe**: soporte.face@correo.gob.es
- **Portal de proveïdors** (consulta manual): https://proveedores.face.gob.es/

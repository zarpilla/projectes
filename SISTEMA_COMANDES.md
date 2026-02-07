# Sistema de Comandes - Documentació Tècnica

## Índex
1. [Introducció](#introducció)
2. [Tipus de Comandes](#tipus-de-comandes)
3. [Comandes Normals (Entrega)](#comandes-normals-entrega)
4. [Comandes de Recollida en Finca](#comandes-de-recollida-en-finca)
5. [Comandes de Punt de Consum](#comandes-de-punt-de-consum)
6. [Camps de Base de Dades](#camps-de-base-de-dades)
7. [Processos Automàtics](#processos-automàtics)
8. [Estats de la Comanda](#estats-de-la-comanda)
9. [Càlcul de Tarifes i Preus](#càlcul-de-tarifes-i-preus)

---

## Introducció

El sistema de comandes gestiona tres tipus diferents de comandes, cadascuna amb les seves característiques i processos automàtics:

1. **Comandes Normals (Entrega)**: Enviament d'un punt d'origen a un punt de destinació
2. **Comandes de Recollida en Finca**: Comandes agregades que recullen múltiples enviaments en un punt de recollida específic
3. **Comandes de Punt de Consum**: Comandes amb múltiples destinataris (línies) dins d'un mateix enviament

---

## Tipus de Comandes

### 1. Comanda Normal (Entrega)

**Descripció**: Una comanda estàndard que envia paquets d'un punt d'origen a un punt de destinació específic.

**Camp identificador**: 
- `is_collection_order = false` (o null)
- `pickup_point = false` (o null)

**Flux de treball**:
1. La sòcia crea una comanda amb les dades del punt d'entrega
2. Selecciona la ruta segons el dia de setmana i destinació
3. Indica el número de caixes, kilograms i si és refrigerada
4. Selecciona el punt de recollida (pickup)
5. Si té punt de recollida en finca, s'activa el mecanisme de recollida automàtica

---

### 2. Comanda de Recollida en Finca

**Descripció**: Comanda agregada que consolida múltiples comandes individuals que es recullen en el mateix punt de recollida dins d'una finca.

**Camp identificador**: 
- `is_collection_order = true`

**Característiques especials**:
- Es crea **automàticament** pel backend quan una comanda té un `collection_point`
- **No es pot crear manualment** per l'usuari
- Agrega dades de totes les comandes associades
- Els camps estan **deshabitats** en el formulari (només lectura)

**Camps calculats automàticament**:
- `units`: Suma total de caixes de totes les comandes associades (no cancel·lades)
- `kilograms`: Suma total de kilograms de totes les comandes associades (no cancel·lades)
- `refrigerated`: TRUE si almenys una comanda associada és refrigerada
- `delivery_type`: Heretat de les comandes associades
- `pickup`: Heretat del punt de recollida (collection_point)
- `collection_point`: Heretat de la comanda que la crea
- `route`: Calculada segons la ciutat del punt de recollida
- `estimated_delivery_date`: Calculada segons el dia de repartiment de la ruta
- `transfer`: Calculat automàticament si cal transferència
- `transfer_pickup_origin`: Punt de recollida on es diposita
- `transfer_pickup_destination`: Punt de recollida destí de la transferència
- `route_rate`: Tarifa calculada excloent tarifes de tipus "Pickup" (només accepta pickup.id === 1)
- `price`: Calculat segons la tarifa i els kilograms agregats
- `comments`: Concatenació de tots els comentaris de les comandes associades en format `#ID_COMANDA comentari\n...`

**Camps deshabilitats en el formulari**:
- Tipus de servei (Refrigerat/Normal)
- Número de caixes
- Kilograms
- Fràgil
- Recollida comanda (pickup)
- Punt de recollida en finca (collection_point)

**Camps ocults en el formulari**:
- Albarà
- Dipòsit
- Recollida

**Relació bidireccional**:
- `collection_orders`: Array amb les comandes individuals associades
- Les comandes normals tenen el camp `collection_order` que referencia a aquesta comanda

---

### 3. Comanda de Punt de Consum

**Descripció**: Comanda que conté múltiples línies, cadascuna amb informació d'un destinatari diferent dins del mateix enviament.

**Camp identificador**: 
- `pickup_point = true`

**Camps específics**:
- `lines`: Array d'objectes amb la informació de cada destinatari
  ```javascript
  {
    units: Number,        // Caixes per aquesta línia
    kilograms: Number,    // Kilograms per aquesta línia
    name: String,         // Nom del destinatari
    nif: String          // NIF del destinatari
  }
  ```

**Càlcul automàtic de totals**:
- `units`: Suma automàtica de `line.units` de totes les línies
- `kilograms`: Suma automàtica de `line.kilograms` de totes les línies

**Característiques**:
- Els camps `units` i `kilograms` principals són només lectura (calculats)
- Cada línia ha de tenir caixes > 0, kilograms > 0 i un nom vàlid
- El preu pot incloure càrrecs addicionals per punt de consum segons la tarifa

---

## Camps de Base de Dades

### Camps Principals

| Camp | Tipus | Descripció | Obligatori |
|------|-------|------------|------------|
| `id` | Integer | Identificador únic | Auto |
| `route_date` | Date | Data de creació de la comanda | Sí |
| `estimated_delivery_date` | Date | Data prevista d'entrega | Sí |
| `delivery_date` | Date | Data real d'entrega | No |
| `status` | String | Estat actual (pending, deposited, processed, lastmile, delivered, invoiced, cancelled) | Sí |
| `owner` | Relation | Sòcia propietària de la comanda | Sí |
| `route` | Relation | Ruta de repartiment | Sí |
| `contact` | Relation | Punt d'entrega o punt de recollida | Sí |
| `delivery_type` | Relation | Tipus de servei (Normal/Refrigerat) | Sí |
| `pickup` | Relation | Punt de recollida on es deixa la comanda | Sí |
| `collection_point` | Relation | Punt de recollida específic dins de la finca | Condicional |
| `units` | Integer | Número de caixes | Sí |
| `kilograms` | Decimal | Pes total en kilograms | Sí |
| `fragile` | Boolean | Indica si és fràgil | No |
| `comments` | Text | Comentaris o instruccions especials | No |
| `is_collection_order` | Boolean | Marca si és una comanda de recollida agregada | No |
| `pickup_point` | Boolean | Marca si és un punt de consum | No |
| `lines` | JSON | Array amb línies per punt de consum | Condicional |
| `collection_orders` | Relation | Comandes individuals associades (si is_collection_order=true) | No |
| `collection_order` | Relation | Comanda de recollida a la que pertany | No |

### Camps de Contacte (Desnormalitzats)

Aquests camps es copien del contacte en crear la comanda:

| Camp | Descripció |
|------|------------|
| `contact_name` | Nom del contacte |
| `contact_trade_name` | Nom comercial |
| `contact_nif` | NIF/CIF |
| `contact_address` | Adreça |
| `contact_postcode` | Codi postal |
| `contact_city` | Població |
| `contact_phone` | Telèfon |
| `contact_legal_form` | Sector/Forma legal |
| `contact_notes` | Notes del contacte |
| `contact_time_slot_1_ini` | Inici franja horària 1 |
| `contact_time_slot_1_end` | Fi franja horària 1 |
| `contact_time_slot_2_ini` | Inici franja horària 2 |
| `contact_time_slot_2_end` | Fi franja horària 2 |

### Camps de Dipòsit i Recollida

| Camp | Descripció |
|------|------------|
| `deposit_date` | Data i hora de dipòsit |
| `deposit_user` | Usuari que fa el dipòsit |
| `pickup_date` | Data i hora de recollida |
| `pickup_user` | Usuari que fa la recollida |

### Camps de Transferència

| Camp | Descripció |
|------|------------|
| `transfer` | Indica si necessita transferència |
| `transfer_pickup_origin` | Punt de recollida origen |
| `transfer_pickup_destination` | Punt de recollida destí |
| `transfer_start_date` | Data inici transferència |
| `transfer_start_user` | Usuari que inicia |
| `transfer_end_date` | Data fi transferència |
| `transfer_end_user` | Usuari que finalitza |
| `last_mile` | Indica si passa per última milla |

### Camps de Facturació

| Camp | Descripció |
|------|------------|
| `route_rate` | Tarifa aplicada |
| `price` | Preu base calculat |
| `multidelivery_discount` | Descompte per multientrega (%) |
| `contact_pickup_discount` | Descompte per recollida en punt (%) |
| `volume_discount` | Descompte per volum (€) |
| `emitted_invoice_datetime` | Data i hora de facturació |

### Camps d'Incidències

| Camp | Descripció |
|------|------------|
| `incidences` | Relació amb incidències associades |

---

## Processos Automàtics

### 1. Creació de Comanda de Recollida (Collection Order)

**Trigger**: `beforeCreate` i `afterUpdate` en el model `orders.js`

**Condicions**:
- La comanda té un `collection_point` assignat
- La comanda NO és ja una `is_collection_order`

**Procés**:

```javascript
// 1. Buscar comanda de recollida existent
const existingCollectionOrders = await strapi.query("orders").find({
  is_collection_order: true,
  owner: ownerId,
  contact: collectionPointId,
  status: "pending",
  _limit: 1
});

// 2. Calcular ruta segons la ciutat del punt de recollida
const route = await calculateRouteForCollectionPoint(collectionPointContact);

// 3. Calcular data estimada d'entrega
const estimatedDeliveryDate = calculateEstimatedDeliveryDate(route);

// 4. Detectar si cal transferència
const transferInfo = await checkTransferNeededForCollectionOrder(pickupId, route.id);

// 5. Crear o actualitzar comanda de recollida
if (collectionOrder) {
  // Actualitzar existent
  await strapi.query("orders").update({ id: collectionOrder.id }, updateData);
  await updateCollectionOrderAggregates(collectionOrder.id);
} else {
  // Crear nova
  const newCollectionOrder = await strapi.query("orders").create(createData);
  await updateCollectionOrderAggregates(newCollectionOrder.id);
}
```

**Camps automàtics en creació**:
- `route_date`: S'estableix automàticament a la data actual si no s'informa
- `is_collection_order`: true
- `owner`: Heretat de la comanda creadora
- `contact`: El collection_point de la comanda creadora
- `pickup`: Heretat de la comanda creadora
- `collection_point`: Heretat de la comanda creadora
- `route`: Calculada segons ciutat del punt de recollida
- `estimated_delivery_date`: Calculada segons ruta
- `status`: "pending"
- `transfer`: Calculat si cal transferència

### 2. Actualització d'Agregats

**Trigger**: Després de crear/actualitzar/eliminar comandes associades

**Funció**: `updateCollectionOrderAggregates(collectionOrderId)`

**Procés**:

```javascript
// 1. Obtenir totes les comandes associades (no cancel·lades)
const relatedOrders = await strapi.query("orders").find({
  collection_order: collectionOrderId,
  status_ne: "cancelled",
  _limit: -1
});

// 2. Calcular agregats
let totalUnits = 0;
let totalKilograms = 0;
let isRefrigerated = false;
let commentsArray = [];

relatedOrders.forEach(order => {
  totalUnits += order.units || 0;
  totalKilograms += parseFloat(order.kilograms || 0);
  if (order.refrigerated) {
    isRefrigerated = true;
  }
  if (order.comments && order.comments.trim() !== '') {
    commentsArray.push(`#${order.id} ${order.comments}`);
  }
});

const concatenatedComments = commentsArray.join('\n');

// 3. Calcular tarifa (excloent "Pickup")
const routeRate = await calculateCollectionOrderRouteRate(collectionOrder, totalKilograms);

// 4. Actualitzar comanda de recollida
await strapi.query("orders").update({ id: collectionOrderId }, {
  units: totalUnits,
  kilograms: totalKilograms,
  refrigerated: isRefrigerated,
  comments: concatenatedComments,
  route_rate: routeRate.id,
  price: calculatePriceFromRouteRate(routeRate, totalKilograms, 0)
});
```

### 3. Càlcul de Tarifa de Recollida

**Funció**: `calculateCollectionOrderRouteRate(collectionOrder, kilograms)`

**Filtres aplicats**:
1. Rutes: Tarifes que apliquen a la ruta específica o totes les rutes
2. Pickup: **EXCLOURE** tarifes de tipus "Pickup" (només acceptar `pickup.id === 1` o null)
3. Tipus d'entrega: Filtrar per delivery_type si està definit

**Prioritat**:
- Tarifes específiques de la ruta > Tarifes generals

### 4. Càlcul de Transferència

**Funció**: `checkTransferNeededForCollectionOrder(pickupId, routeId)`

**Lògica**:
```javascript
// 1. Obtenir ciutat del pickup
const pickup = await strapi.query("pickups").findOne({ id: pickupId });
const pickupCityId = pickup.city.id || pickup.city;

// 2. Comprovar si la ruta serveix aquesta ciutat
const cityRoutes = await strapi.query("city-route").find({
  city: pickupCityId,
  route: routeId
});

// 3. Si la ruta NO serveix la ciutat, cal transferència
if (cityRoutes.length === 0) {
  return {
    transfer: true,
    transfer_pickup_origin: pickupId,
    transfer_pickup_destination: route.transfer_pickup
  };
}
```

### 5. Descomptes Automàtics

#### Descompte de Multientrega

**Trigger**: Quan es crea o actualitza una comanda

**Condicions**:
- Múltiples comandes de la mateixa sòcia
- Mateixa ruta
- Mateixa data d'entrega
- Estat "pending"

**Càlcul**:
```javascript
const discountToApply = ownerFactor * (owner.orders_options?.multidelivery_discount || 0);
```

#### Descompte de Volum

**Trigger**: Quan es crea o actualitza una comanda

**Condicions**:
- Número de comandes >= `route.volume_discount_number_of_orders`
- Mateixa ruta, data i sòcia

**Càlcul**:
```javascript
if (count >= route.volume_discount_number_of_orders) {
  discount = route.volume_discount_price; // Descompte fix en €
}
```

### 6. Eliminació en Cascada

**Trigger**: `beforeDelete` en comanda de recollida

**Procés**:
```javascript
// Si s'elimina una is_collection_order, desvincula totes les comandes associades
if (params.is_collection_order) {
  const relatedOrders = await strapi.query("orders").find({
    collection_order: params.id
  });
  
  for (const order of relatedOrders) {
    await strapi.query("orders").update(
      { id: order.id },
      { collection_order: null }
    );
  }
}
```

---

## Estats de la Comanda

| Estat | Codi | Descripció |
|-------|------|------------|
| Pendent | `pending` | Comanda creada, pendent de dipositar |
| Depositada | `deposited` | Paquets dipositats al punt de recollida |
| Processada | `processed` | En procés de repartiment |
| Última Milla | `lastmile` | En servei d'última milla |
| Lliurada | `delivered` | Entregada al destinatari |
| Facturada | `invoiced` | Facturada |
| Anul·lada | `cancelled` | Comanda cancel·lada |

**Transicions permeses**:
- Sòcies: Poden cancel·lar només comandes en estat `pending`
- Administradors: Poden modificar qualsevol estat

---

## Càlcul de Tarifes i Preus

### Selecció de Tarifa

**Frontend**: `assignRouteRate(form, routeRates, orders)`

**Filtres**:
1. **Ruta**: Tarifes que apliquen a la ruta o totes les rutes
2. **Pickup vs Collection Point**:
   - Si té `collection_point`: Excloure tarifes "Pickup" (només `pickup.id === 1` o null)
   - Si NO té `collection_point`: Filtrar per pickup específic
3. **Tipus d'entrega**: Filtrar per delivery_type si està definit

**Prioritat**:
- Tarifes específiques de ruta > Tarifes generals

### Càlcul de Preu

**Funció**: `calculatePriceFromRouteRate(routeRate, kilograms, pickupLines)`

#### Tarifa Antiga (ratev2 = false):
```javascript
if (kilograms < 15) {
  price = routeRate.less15;
} else if (kilograms < 30) {
  price = routeRate.less30;
} else {
  price = routeRate.less30 + (kilograms - 30) * routeRate.additional30;
}
```

#### Tarifa Nova (ratev2 = true):
```javascript
// Interpolació lineal entre trams de 10kg
if (kilograms < 10) {
  price = routeRate.less10;
} else if (kilograms <= 20) {
  const t = (kilograms - 10) / 10;
  price = routeRate.more10 + t * (routeRate.from10to20 - routeRate.more10);
} else if (kilograms <= 30) {
  const t = (kilograms - 20) / 10;
  price = routeRate.from10to20 + t * (routeRate.from20to30 - routeRate.from10to20);
}
// ... fins a 60kg, després càrrec adicional
else if (kilograms > 60) {
  price = routeRate.from50to60 + (kilograms - 60) * routeRate.additional60;
}

// Afegir càrrec per punt de consum
if (pickupLines > 0 && routeRate.pickup_point) {
  price += pickupLines * routeRate.pickup_point;
}
```

### Preu Final amb Descomptes

```javascript
const finalPrice = (price - volume_discount) 
  * (1 - multidelivery_discount / 100) 
  * (1 - contact_pickup_discount / 100);
```

---

## Validacions

### Comandes Normals

- Sòcia obligatòria
- Ruta obligatòria
- Punt d'entrega obligatori i vàlid
- Tipus de servei obligatori
- Punt de recollida obligatori
- Caixes > 0
- Kilograms > 0
- Data d'entrega vàlida segons dies de ruta

### Comandes de Punt de Consum

- Mínim 1 línia
- Cada línia ha de tenir:
  - Caixes > 0
  - Kilograms > 0
  - Nom no buit

### Comandes de Recollida

- **No es poden crear manualment**
- Es generen automàticament
- Els camps són només lectura (calculats)

---

## Fluxos de Treball

### Flux Comanda Normal

1. **Crear comanda**
   - Seleccionar sòcia, ruta, punt d'entrega
   - Informar caixes, kilograms, tipus
   - Seleccionar pickup i collection_point (opcional)

2. **Si té collection_point**
   - Backend crea/actualitza comanda de recollida automàticament
   - S'afegeix a `collection_orders` de la comanda de recollida
   - Camp `collection_order` apunta a la comanda agregada

3. **Dipositar**
   - Marcar com dipositada amb data i usuari

4. **Recollir**
   - Marcar com recollida amb data i usuari

5. **Lliurar**
   - Canviar estat a "delivered"
   - S'estableix `delivery_date`

6. **Facturar**
   - Estat "invoiced"
   - S'estableix `emitted_invoice_datetime`

### Flux Comanda de Recollida

1. **Creació automàtica**
   - Quan una comanda amb `collection_point` es crea/actualitza
   - Es busca comanda de recollida pendent existent o es crea nova

2. **Actualització contínua**
   - Cada vegada que una comanda associada canvia
   - Es recalculen units, kilograms, refrigerated, comments
   - S'actualitza tarifa i preu

3. **Eliminació**
   - Si es cancel·la una comanda associada, no es compta en els agregats
   - Si s'elimina la comanda de recollida, es desvinculen totes les comandes

### Flux Punt de Consum

1. **Crear comanda amb URL** `?pickup_point=true`

2. **Afegir línies**
   - Cada línia amb caixes, kilograms, nom, NIF

3. **Càlcul automàtic**
   - Totals de caixes i kilograms

4. **Preu**
   - Preu base segons kilograms
   - Càrrec adicional per línia si la tarifa ho contempla

---

## Fitxers Tècnics Principals

### Backend

- **`projectes/api/orders/models/orders.js`** (1213 línies)
  - Lifecycle hooks: `beforeCreate`, `afterCreate`, `afterUpdate`, `beforeDelete`, `afterDelete`
  - Funcions principals:
    - `processCollectionOrder()`: Creació/actualització comanda recollida
    - `updateCollectionOrderAggregates()`: Càlcul d'agregats
    - `calculateRouteForCollectionPoint()`: Càlcul de ruta
    - `calculateEstimatedDeliveryDate()`: Càlcul data entrega
    - `checkTransferNeededForCollectionOrder()`: Detecció transferència
    - `calculateCollectionOrderRouteRate()`: Càlcul tarifa sense "Pickup"
    - `calculatePriceFromRouteRate()`: Càlcul de preu
    - `checkVolumeDiscount()`: Descompte per volum
    - `processVolumeDiscountForCurrentOrder()`: Aplicació descomptes

### Frontend

- **`projectes-front/src/components/OrdersForm.vue`** (2847 línies)
  - Formulari principal de comandes
  - Gestió de 3 tipus de comandes
  - Validacions client
  - Taules de visualització de relacions

- **`projectes-front/src/service/assignRouteRate.js`** (220 línies)
  - `assignRouteRate()`: Assignació de tarifa
  - `assignRouteDate()`: Càlcul data segons ruta
  - `checkIfDateIsValidInroute()`: Validació data
  - `calculateRoutePrice()`: Càlcul de preu

---

## Notes Importants

1. **Comandes de recollida** NO es poden crear manualment, sempre són automàtiques

2. **Agregació en temps real**: Els càlculs d'agregats s'actualitzen amb cada canvi en les comandes associades

3. **Comentaris concatenats**: Els comentaris de les comandes associades es mostren en la comanda de recollida en format `#ID comentari`

4. **Tarifes excloses**: Les comandes de recollida NO usen tarifes de tipus "Pickup" (només pickup.id === 1)

5. **Camps deshabilitats**: Els camps calculats automàticament estan deshabilitats en el formulari per evitar confusions

6. **Bidireccionalitat**: La relació entre comanda normal i comanda de recollida és bidireccional i es mostra en taules

7. **Eliminació**: Les comandes cancel·lades NO es compten en els agregats de recollida

8. **Transferències**: Es detecten automàticament quan el pickup no està en la ruta de destinació

9. **Descomptes**: S'apliquen automàticament segons configuració de sòcia i ruta

10. **Incidències**: Es poden afegir incidències a qualsevol comanda, però només són visibles per administradors

---

## Exemples Pràctics

### Exemple 1: Comanda Normal Simple

```javascript
{
  owner: 5,                    // Sòcia ID 5
  route: 2,                    // Ruta "Dijous Barcelonès"
  contact: 123,                // Client "Restaurant Ca la Maria"
  delivery_type: 1,            // Normal (no refrigerat)
  pickup: 1,                   // "La Diligència"
  units: 3,                    // 3 caixes
  kilograms: 12.5,             // 12.5 kg
  comments: "Deixar a la porta del darrere",
  estimated_delivery_date: "2026-02-12"
}
```

### Exemple 2: Comanda amb Recollida en Finca

```javascript
// Comanda creada per la sòcia
{
  owner: 8,
  route: 3,
  contact: 456,
  delivery_type: 2,            // Refrigerat
  pickup: 5,                   // "Can Masdeu"
  collection_point: 12,        // "Punt A - Can Masdeu"
  units: 2,
  kilograms: 8.0,
  comments: "Productes frescos"
}

// Automàticament es crea/actualitza:
{
  id: 999,
  is_collection_order: true,
  owner: 8,
  contact: 12,                 // El collection_point
  pickup: 5,
  collection_point: 12,
  route: 4,                    // Calculada per ciutat de contact 12
  units: 2,                    // Agregat de comandes
  kilograms: 8.0,              // Agregat de comandes
  refrigerated: true,          // Si alguna és refrigerada
  comments: "#456 Productes frescos",
  collection_orders: [456]     // Array de comandes
}
```

### Exemple 3: Punt de Consum

```javascript
{
  owner: 10,
  route: 1,
  contact: 789,                // Punt de consum "AgroEcològica"
  delivery_type: 1,
  pickup: 1,
  pickup_point: true,
  lines: [
    { units: 2, kilograms: 5.0, name: "Maria García", nif: "12345678A" },
    { units: 1, kilograms: 3.5, name: "Joan Martí", nif: "87654321B" },
    { units: 3, kilograms: 8.0, name: "Anna Puig", nif: "11223344C" }
  ],
  units: 6,                    // Calculat: 2+1+3
  kilograms: 16.5              // Calculat: 5.0+3.5+8.0
}
```

---

**Versió**: 1.0  
**Data**: Febrer 2026  
**Autor**: Sistema de Comandes La Diligència

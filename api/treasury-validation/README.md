# Treasury Movement Validation System

## Overview
Track validated treasury movements to ensure bank reconciliation accuracy. Users can mark executed movements (paid/real) as "validated" to confirm they've been checked against bank statements.

## Features
- ✅ Validate individual movements with a simple checkbox
- ✅ Validation persists across sessions
- ✅ Tracks who validated and when
- ✅ Works for all movement types: invoices, payrolls, treasury operations, etc.
- ✅ Supports derived movements (IRPF, SS, Other from payrolls)

## User Interface

### Treasury Table
In the "Accions" (Actions) column, you'll see:
1. **Warning icon** (⚠️) - For expected/planned movements that are overdue (before today and not executed)
2. **Validation checkbox** (☑️) - For executed movements (paid or real) that can be validated

### How to Use
1. Go to the Tresoreria (Treasury) page
2. Find an executed movement (factura pagada, nòmina pagada, etc.)
3. Click the checkbox in the "Accions" column to mark it as validated
4. Click again to remove validation

## Technical Details

### Backend
**New Strapi Collection:** `treasury-validations`
- Stores validation records with composite key: `{entity_type}:{entity_id}:{sub_type}`
- Unique constraint prevents duplicate validations
- Tracks validated_by user and timestamp

**API Endpoints:**
- `POST /treasury-validations/toggle` - Toggle validation status
- `GET /treasury-validations` - List all validations
- `DELETE /treasury-validations/:id` - Remove validation

### Movement Types That Can Be Validated
All executed (paid/real) movements:
- Factura cobrada/emesa
- Factura pagada/rebuda
- Ingrés cobrat/emès
- Despesa pagada/rebuda
- Nòmina pagada
- IRPF Nòmina
- SS pagat
- Altres Nòmina
- Operació de tresoreria
- Saldo real ajustat
- Saldo bancari

### Database Schema
```sql
CREATE TABLE treasury_validations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  entity_type ENUM('emitted-invoices', 'received-invoices', 'received-incomes', 
                   'received-expenses', 'payrolls', 'treasuries'),
  entity_id INT NOT NULL,
  sub_type ENUM('irpf', 'ss', 'other') NULL,
  validated_by INT REFERENCES users_permissions_user(id),
  notes TEXT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE KEY unique_validation (entity_type, entity_id, sub_type)
);
```

## Testing
1. Restart Strapi backend: `npm run develop` in `/projectes`
2. Navigate to Tresoreria page
3. Find a paid invoice or payroll
4. Click the validation checkbox
5. Refresh page - validation should persist
6. Check Strapi admin panel - treasury-validations collection should exist

## Future Enhancements
- [ ] Bulk validation for multiple movements
- [ ] Validation notes/comments
- [ ] Validation reports/statistics
- [ ] Filter movements by validation status
- [ ] Require validation before closing periods

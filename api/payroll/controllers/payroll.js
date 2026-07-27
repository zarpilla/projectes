"use strict";
const _ = require("lodash");
const moment = require("moment");

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize the controller
 */

// A relation field may come back from Strapi as a populated object { id },
// as a raw id, or be null/undefined. Normalize it to a comparable string.
const idOf = (value) => {
  if (value == null) return null;
  if (typeof value === "object") return value.id != null ? String(value.id) : null;
  return String(value);
};

module.exports = {
  async createAll(ctx) {
    // const month = ctx.query.month
    const year = ctx.query.year;

    const months = await strapi
      .query("month")
      .find({ _limit: -1 });

    const years = await strapi
    .query("year")
    .find({ _limit: -1 });
    
    const users = await strapi
      .query("user", "users-permissions")
      .find({ _limit: -1 });

    const userPayrollsInfo = []
    
    for (let i = 0; i < users.length; i++) {

      const userPayrollsCreated = [];
      const userPayrollsExsist = [];
      const user = users[i];
      const dedications = await strapi
        .query("daily-dedication")
        .find({ users_permissions_user: user.id, _limit: -1 });

      // Explicitly populate year/month so the existence check always has {id}
      // objects to compare. Without populate a relation can come back as a bare
      // id, which would make every comparison fail and create duplicates.
      const userPayrolls = await strapi
        .query("payroll")
        .find({ users_permissions_user: user.id, _limit: -1 }, [
          "year",
          "month",
          "users_permissions_user",
        ]);

      if (dedications && dedications.length) {
        for (let m = 1; m <= 12; m++) {
          const emitted = moment(`${year}-${m}-01`, "YYYY-MM-DD")
            .endOf("month")
            .format("YYYY-MM-DD");

          const dedication = dedications.find(
            (dd) => emitted >= dd.from && emitted <= dd.to
          );
          if (dedication) {
            

            const month = months.find(mo => mo.month == m)
            const y = years.find(ye => ye.year == year)

            if (!month || !y) {
              continue;
            }

            const yearId = String(y.id);
            const monthId = String(month.id);

            // Is there already a payroll for this (user, year, month) in our
            // snapshot? Relations are normalized to ids via idOf().
            const payrollExist = userPayrolls.find(
              (up) =>
                idOf(up.year) === yearId && idOf(up.month) === monthId
            );


            if (!payrollExist) {
              // Defense in depth: even if two create-all requests overlap
              // (e.g. a double click before the frontend guard landed), each
              // run reads the existing payrolls only once. Re-query right
              // before the insert so we don't duplicate a (user, year, month)
              // that the other concurrent run just committed.
              const justCreated = await strapi.query("payroll").findOne({
                users_permissions_user: user.id,
                year: y.id,
                month: month.id,
              });

              if (justCreated) {
                userPayrollsExsist.push(justCreated);
                continue;
              }

              const total = dedication.hours / 8 * dedication.monthly_salary;

            const payroll = {
                month: month.id,
                year: y.id,
                users_permissions_user: user.id,
                total_base: total,
                total: total,
                total_irpf: 0,
                total_vat: 0,
                paid: false,
                emitted: emitted,
                net_base: 0,
                net_date: emitted,
                ss_base: dedication.pct_quota
                  ? (total * dedication.pct_quota) / 100
                  : dedication.quota,
                ss_date: moment(`${year}-${m}-01`, "YYYY-MM-DD")
                  .add(1, "month")
                  .endOf("month")
                  .format("YYYY-MM-DD"), // mes següent vençut
                irpf_base: dedication.pct_irpf
                  ? (total * dedication.pct_irpf) / 100
                  : 0,
                irpf_date: moment(`${year}-${m}-01`, "YYYY-MM-DD")
                  .endOf("quarter")
                  .add(20, "day")
                  .format("YYYY-MM-DD"),
                other_base: dedication.pct_other
                  ? (total * dedication.pct_other) / 100
                  : 0,
                other_date: moment(`${year}-${m}-01`, "YYYY-MM-DD")
                  .add(1, "month")
                  .endOf("month")
                  .format("YYYY-MM-DD"),
              };
        
              payroll.net_base =
                parseFloat(payroll.total) -
                parseFloat(payroll.irpf_base) -
                parseFloat(payroll.other_base);
              payroll.total =
                parseFloat(payroll.total) + parseFloat(payroll.ss_base || 0);

                const payrollDb = await strapi.query("payroll").create(payroll);

                // Keep our snapshot in sync so later iterations in this same
                // run see the payroll we just created.
                userPayrolls.push(payrollDb);

                userPayrollsCreated.push(payrollDb);

            } else {
                userPayrollsExsist.push(payrollExist);
            }

            
            
            


          }

        }

        userPayrollsInfo.push({ user: user.id, username: user.username, created: userPayrollsCreated.length, existing: userPayrollsExsist.length });

      }
    }

    //     for(let i = 0; i < acTypes.length; i++) {

    //   const dailyDedication = this.dailyDedications.find(
    //     (dd) => emitted >= dd.from && emitted <= dd.to
    //   );

    return { userPayrollsInfo };
  },
};

"use strict";
const _ = require("lodash");
const moment = require("moment");

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

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

      const userPayrolls = await strapi
        .query("payroll")
        .find({ users_permissions_user: user.id, _limit: -1 });

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

            // console.log('month', month)
            // console.log('year', y)
            // console.log('userPayrolls', userPayrolls)

            const payrollExist = userPayrolls.find(up => up.year && up.year.id === y.id && up.month && up.month.id === month.id)


            if (!payrollExist) {
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
                  .endOf("quarter")
                  .add(20, "day")
                  .format("YYYY-MM-DD"),
              };
        
              payroll.net_base =
                parseFloat(payroll.total) -
                parseFloat(payroll.irpf_base) -
                parseFloat(payroll.other_base);
              payroll.total =
                parseFloat(payroll.total) + parseFloat(payroll.ss_base || 0);

                const payrollDb = await strapi.query("payroll").create(payroll);


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

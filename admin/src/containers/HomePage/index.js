import React, { memo } from "react";
import { ALink, Block, Container } from "./components";
import { get, upperFirst } from "lodash";
import { auth, LoadingIndicatorPage } from "strapi-helper-plugin";
import axios from "axios";
import Menu from './menu'

const HomePage = ({ global: { plugins }, history: { push } }) => {
  let appUrl = "";
  let appQs = "";

  const linkActivitiesInput = {
    id: "app.components.HomePage.button.blog1",
    href: "",
    onClick: (e) => {
      e.preventDefault();
      window.open(`${appUrl}${appQs}&navigate=dedicacio`);
    },
    type: "blog",
    target: "_blank",
  };

  const linkStats = {
    id: "app.components.HomePage.button.blog2",
    href: "",
    onClick: (e) => {
      e.preventDefault();
      window.open(`${appUrl}${appQs}`);
    },
    type: "blog",
    target: "_blank",
  };

  const linkProjects = {
    id: "app.components.HomePage.button.blog3",
    onClick: (e) => {
      e.preventDefault();
      push(
        "/plugins/content-manager/collectionType/application::project.project"
      );
    },
    type: "blog",
  };

  const linkFestives = {
    id: "app.components.HomePage.button.blog11",
    onClick: (e) => {
      e.preventDefault();
      push(
        "/plugins/content-manager/collectionType/application::festive.festive"
      );
    },
    type: "blog",
  };

  const linkDailyDedications = {
    id: "app.components.HomePage.button.blog3",
    onClick: (e) => {
      e.preventDefault();
      push(
        "/plugins/content-manager/collectionType/application::daily-dedication.daily-dedication"
      );
    },
    type: "blog",
  };

  const linkQuotes = {
    id: "app.components.HomePage.button.blog4",
    onClick: (e) => {
      e.preventDefault();
      push("/plugins/content-manager/collectionType/application::quote.quote");
    },
    type: "blog",
  };

  const linkReceivedInvoices = {
    id: "app.components.HomePage.button.blog5",
    onClick: (e) => {
      e.preventDefault();
      push(
        "/plugins/content-manager/collectionType/application::received-invoice.received-invoice"
      );
    },
    type: "blog",
  };

  const linkEmittedInvoices = {
    id: "app.components.HomePage.button.blog6",
    onClick: (e) => {
      e.preventDefault();
      push(
        "/plugins/content-manager/collectionType/application::emitted-invoice.emitted-invoice"
      );
    },
    type: "blog",
  };

  const linkTickets = {
    id: "app.components.HomePage.button.blog7",
    onClick: (e) => {
      e.preventDefault();
      push(
        "/plugins/content-manager/collectionType/application::ticket.ticket"
      );
    },
    type: "blog",
  };

  const linkDiets = {
    id: "app.components.HomePage.button.blog8",
    onClick: (e) => {
      e.preventDefault();
      push("/plugins/content-manager/collectionType/application::diet.diet");
    },
    type: "blog",
  };

  const linkEmittedGrants = {
    id: "app.components.HomePage.button.blog9",
    onClick: (e) => {
      e.preventDefault();
      push(
        "/plugins/content-manager/collectionType/application::emitted-grant.emitted-grant"
      );
    },
    type: "blog",
  };

  const linkReceivedGrants = {
    id: "app.components.HomePage.button.blog10",
    onClick: (e) => {
      e.preventDefault();
      push(
        "/plugins/content-manager/collectionType/application::received-grant.received-grant"
      );
    },
    type: "blog",
  };

  const linkContacts = {
    id: "app.components.HomePage.button.blog12",
    onClick: (e) => {
      e.preventDefault();
      push(
        "/plugins/content-manager/collectionType/application::contacts.contacts"
      );
    },
    type: "blog",
  };

  

  const userInfo = auth.getUserInfo();
  const firstname = get(userInfo, "firstname", "");
  const username = get(userInfo, "username", "");
  const token = auth.getToken();
  const headers = { headers: { Authorization: "Bearer " + token } };
  const configUrl = `${strapi.backendURL}/content-manager/single-types/application::config.config`;
  axios
    .get(configUrl, headers)
    .then(async (configData) => {
      const config = configData.data;
      // console.log("config", configData.data);

      const { data } = await axios.post(`${strapi.backendURL}/auth/local`, {
        identifier: config.app_username,
        password: config.app_pwd,
      });
      appUrl = config.front_url;
      appQs = `?jwt=${data.jwt}&username=${username}`;
    })
    .catch((e) => {
      console.error(e);
    });

  const menuUrl = `${strapi.backendURL}/content-manager/single-types/application::home-menu.home-menu`;

  // const menuData = await axios.get(menuUrl, headers)
  // console.log("menu", menuData);

  let menu = []
  axios
    .get(menuUrl, headers)
    .then(async (menuData) => {
      menu = menuData.data.homegroup;
      console.log("menu", menu);

      // const { data } = await axios.post(`${strapi.backendURL}/auth/local`, {
      //   identifier: config.app_username,
      //   password: config.app_pwd,
      // });
      // appUrl = config.front_url;
      // appQs = `?jwt=${data.jwt}&username=${username}`;
    })
    .catch((e) => {
      console.error(e);
    });

  // const handleClickProjects = e => {
  //     e.preventDefault();

  //     window.open('http://localhost:8080/#/')
  // };
  return (
    <>
      <Container className="container-fluid">

      {/* <div className="row">
          <div className="col-12">
            
          </div>
      </div> */}

        <div className="row">
          <div className="col-12">

            <Menu></Menu>

            {/* <Block>Hello World!</Block> */}
            <div className="row">
              <h2 className="col-lg-12 col-md-12 col-xs-12">Projectes</h2>
              <div className="col-lg-2 col-md-3 col-xs-12">
                <ALink
                  rel="noopener noreferrer"
                  {...linkProjects}
                  style={{ verticalAlign: "bottom", marginBottom: 5, cursor: "pointer" }}
                >
                  Projectes
                </ALink>
              </div>
              <div className="col-lg-2 col-md-3 col-xs-12">
                <ALink
                  rel="noopener noreferrer"
                  {...linkStats}
                  style={{ verticalAlign: "bottom", marginBottom: 5, cursor: "pointer" }}
                >
                  Estadístiques
                </ALink>
              </div>
            </div>
            <div className="row">
              <h2 className="col-lg-12 col-md-12 col-xs-12" style={{ marginTop: 25 }}>Contactes</h2>
              <div className="col-lg-2 col-md-3 col-xs-12">
                <ALink
                  rel="noopener noreferrer"
                  {...linkContacts}
                  style={{ verticalAlign: "bottom", marginBottom: 5, cursor: "pointer" }}
                >
                  Contactes
                </ALink>
              </div>
            </div>
            <div className="row">
              <h2 className="col-lg-12 col-md-12 col-xs-12" style={{ marginTop: 25 }}>Dedicació</h2>
              <div className="col-lg-2 col-md-3 col-xs-12">
                <ALink
                  rel="noopener noreferrer"
                  {...linkActivitiesInput}
                  style={{ verticalAlign: "bottom", marginBottom: 5, cursor: "pointer" }}
                >
                  Entrada Hores
                </ALink>
              </div>

              <div className="col-lg-2 col-md-3 col-xs-12">
                <ALink
                  rel="noopener noreferrer"
                  {...linkFestives}
                  style={{ verticalAlign: "bottom", marginBottom: 5, cursor: "pointer" }}
                >
                  Festius
                </ALink>
              </div>
              <div className="col-lg-2 col-md-3 col-xs-12">
                <ALink
                  rel="noopener noreferrer"
                  {...linkDailyDedications}
                  style={{ verticalAlign: "bottom", marginBottom: 5, cursor: "pointer" }}
                >
                  Calendaris
                </ALink>
              </div>
            </div>

            <div className="row">
              <h2 className="col-lg-12 col-md-12 col-xs-12" style={{ marginTop: 25 }}>Documents emesos</h2>
              <div className="col-lg-2 col-md-3 col-xs-12">
                <ALink
                  rel="noopener noreferrer"
                  {...linkQuotes}
                  style={{ verticalAlign: "bottom", marginBottom: 5, cursor: "pointer" }}
                >
                  Pressupostos Emesos
                </ALink>
              </div>
              <div className="col-lg-2 col-md-3 col-xs-12">
                <ALink
                  rel="noopener noreferrer"
                  {...linkEmittedInvoices}
                  style={{ verticalAlign: "bottom", marginBottom: 5, cursor: "pointer" }}
                >
                  Factures Emeses
                </ALink>
              </div>
              <div className="col-lg-2 col-md-3 col-xs-12">
                <ALink
                  rel="noopener noreferrer"
                  {...linkEmittedGrants}
                  style={{ verticalAlign: "bottom", marginBottom: 5, cursor: "pointer" }}
                >
                  Subvencions Emeses
                </ALink>
              </div>
            </div>
            <div className="row">
            <h2 className="col-lg-12 col-md-12 col-xs-12" style={{ marginTop: 25 }}>Documents rebuts</h2>
              <div className="col-lg-2 col-md-3 col-xs-12">
                <ALink
                  rel="noopener noreferrer"
                  {...linkReceivedInvoices}
                  style={{ verticalAlign: "bottom", marginBottom: 5, cursor: "pointer" }}
                >
                  Factures Rebudes
                </ALink>
              </div>
              <div className="col-lg-2 col-md-3 col-xs-12">
                <ALink
                  rel="noopener noreferrer"
                  {...linkTickets}
                  style={{ verticalAlign: "bottom", marginBottom: 5, cursor: "pointer" }}
                >
                  Tiquets
                </ALink>
              </div>
              <div className="col-lg-2 col-md-3 col-xs-12">
                <ALink
                  rel="noopener noreferrer"
                  {...linkDiets}
                  style={{ verticalAlign: "bottom", marginBottom: 5, cursor: "pointer" }}
                >
                  Dietes
                </ALink>
              </div>

              <div className="col-lg-2 col-md-3 col-xs-12">
                <ALink
                  rel="noopener noreferrer"
                  {...linkReceivedGrants}
                  style={{ verticalAlign: "bottom", marginBottom: 5, cursor: "pointer" }}
                >
                  Subvencions Rebudes
                </ALink>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </>
  );
};

export default memo(HomePage);

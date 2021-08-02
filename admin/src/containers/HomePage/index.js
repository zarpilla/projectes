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
          </div>
        </div>
      </Container>
    </>
  );
};

export default memo(HomePage);

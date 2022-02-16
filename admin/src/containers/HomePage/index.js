import React, { memo } from "react";
import { ALink, Block, Container } from "./components";
import { get, upperFirst } from "lodash";
import { auth, LoadingIndicatorPage } from "strapi-helper-plugin";
import axios from "axios";
import Menu from './menu'

const HomePage = ({ global: { plugins }, history: { push } }) => {
  const userInfo = auth.getUserInfo();
  const firstname = get(userInfo, "firstname", "");
  const username = get(userInfo, "username", "");
  const token = auth.getToken();
  const headers = { headers: { Authorization: "Bearer " + token } };  
  const menuUrl = `${strapi.backendURL}/content-manager/single-types/application::home-menu.home-menu`;

  let menu = []
  axios
    .get(menuUrl, headers)
    .then(async (menuData) => {
      menu = menuData.data.homegroup;      
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

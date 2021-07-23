import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { auth } from "strapi-helper-plugin";
import { ALink, Block, Container } from "./components";
import { useHistory } from "react-router-dom";
import { get } from "lodash";

const Menu = () => {
  const history = useHistory();

  const [data, setData] = useState({ groups: [] });

  const token = auth.getToken();
  const headers = { headers: { Authorization: "Bearer " + token } };

  const menuUrl = `${strapi.backendURL}/content-manager/single-types/application::home-menu.home-menu`;

  useEffect(() => {
    const fetchData = async () => {

      const configUrl = `${strapi.backendURL}/content-manager/single-types/application::config.config`;
      const configData = await axios.get(configUrl, headers)    
      const config = configData.data;
      const userInfo = auth.getUserInfo();
      const username = get(userInfo, "username", "");
        
      const { data } = await axios.post(`${strapi.backendURL}/auth/local`, {
        identifier: config.app_username,
        password: config.app_pwd,
      });
      const appUrl = config.front_url;
      const appQs = `?jwt=${data.jwt}&username=${username}`;
    

      const result = await axios(menuUrl, headers);
      result.data.homegroup.forEach(hg => {
        hg.items.forEach(i => {
          if (i.open) {
            i.link = {
              id: "app.components.HomePage.button.blog3",
              onClick: (e) => {
                e.preventDefault();
                history.push(
                  `/plugins/content-manager/collectionType/application::${i.open}.${i.open}`
                );
              },
              type: "blog",
            }
          }
          else if (i.navigate) {
            i.link = {
              id: "app.components.HomePage.button.blog3",
              onClick: (e) => {
                e.preventDefault();
                window.open(`${appUrl}${appQs}${i.navigate}`);
              },
              type: "blog",
            }
          }
        })
      });
      setData({ groups: result.data.homegroup });
    };
 
    fetchData();
  }, []);

  return (
    <div>
      {data.groups.map(item => (
        <div className="row" key={item.id}>
          <h2 className="col-lg-12 col-md-12 col-xs-12">{item.name}</h2>
          {item.items.map(subitem => (
            <div className="col-lg-2 col-md-3 col-xs-12" key={subitem.id}>
              <ALink
                  rel="noopener noreferrer"
                  {...subitem.link}
                  style={{ verticalAlign: "bottom", marginBottom: 25, cursor: "pointer" }}
                >
                  {subitem.text}
                </ALink>
              
            </div>
          ))}
          
        </div>          
      ))}
    </div>
  );

};




export default Menu;
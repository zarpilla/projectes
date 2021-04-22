import React, { memo } from 'react';
import { ALink, Block, Container } from './components';
import { get, upperFirst } from 'lodash';
import { auth, LoadingIndicatorPage } from 'strapi-helper-plugin';
import axios from 'axios';

const HomePage = ({ global: { plugins }, history: { push } }) => {

    let appUrl = ''
    let appQs = ''

    const linkProjects = {
        id: 'app.components.HomePage.button.blog1',
        href: '',
        onClick: (e) => { e.preventDefault(); window.open(`${appUrl}dedicacio${appQs}`) },
        type: 'blog',
        target: '_blank',
    };

    const linkStats = {
        id: 'app.components.HomePage.button.blog2',
        href: '',
        onClick: (e) => { e.preventDefault(); window.open(`${appUrl}${appQs}`) },
        type: 'blog',
        target: '_blank',
    };

    const userInfo = auth.getUserInfo();
    const firstname = get(userInfo, 'firstname', '');
    const username = get(userInfo, 'username', '');
    const token = auth.getToken()
    const headers = { headers: {'Authorization': 'Bearer ' + token }};
    const configUrl = `${strapi.backendURL}/content-manager/single-types/application::config.config`
    axios.get(
        configUrl,
        headers
    ).then(async configData => {
        const config = configData.data
        console.log('config', configData.data)

        const { data } = await axios.post(`${strapi.backendURL}/auth/local`, {
            identifier: config.app_username,
            password: config.app_pwd,
        });
        appUrl = config.front_url
        appQs = `?jwt=${data.jwt}&username=${username}`

    }).catch((e) => {
        console.error(e)
    })
    

    // const handleClickProjects = e => {
    //     e.preventDefault();
    
    //     window.open('http://localhost:8080/#/')
    // };
  return (
    <>
      <Container className="container-fluid">
        <div className="row">
          <div className="col-12">
            {/* <Block>Hello World!</Block> */}
            <div className="row">
                <div className="col-lg-2 col-md-3 col-xs-12">
                  <ALink
                      rel="noopener noreferrer"
                      {...linkProjects}
                      style={{ verticalAlign: ' bottom', marginBottom: 5 }}
                    >
                      Entrada Hores
                    </ALink>                  
                </div>
                <div className="col-lg-2 col-md-3 col-xs-12">
                  <ALink
                      rel="noopener noreferrer"
                      {...linkStats}
                      style={{ verticalAlign: ' bottom', marginBottom: 5 }}
                    >
                      Estadístiques
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

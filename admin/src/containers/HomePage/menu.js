import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { auth } from "strapi-helper-plugin";
import { ALink, Block, Container } from "./components";

const Menu = () => {

  const [data, setData] = useState({ groups: [] });

  const token = auth.getToken();
  const headers = { headers: { Authorization: "Bearer " + token } };

  const menuUrl = `${strapi.backendURL}/content-manager/single-types/application::home-menu.home-menu`;

  useEffect(() => {
    const fetchData = async () => {
      const result = await axios(menuUrl, headers);
      console.log('result', result)
      setData({ groups: result.data.homegroup });
    };
 
    fetchData();
  }, []);

  const onClick = (e) => {
    console.log('e', e)
  }

  const link = {
    id: "app.components.HomePage.button.blog3",
    onClick: (e) => {
      e.preventDefault();
      push(
        "/plugins/content-manager/collectionType/application::project.project"
      );
    },
    type: "blog",
  };
 
  return (
    <div>
      {data.groups.map(item => (
        <div className="row" key={item.id}>
          <h2 className="col-lg-12 col-md-12 col-xs-12">{item.name}</h2>
          {item.items.map(subitem => (
            <div className="col-lg-2 col-md-3 col-xs-12" key={subitem.id}>
              <a
                  href={subitem.open}
                  style={{ verticalAlign: "bottom", marginBottom: 5, cursor: "pointer" }}
                >
                  {subitem.text}
                </a>
              
            </div>
          ))}
          
        </div>          
      ))}
    </div>
  );

  //   const [languages, setLanguages] = useState([]);
  //   useEffect(() => {
  //     getLanguages().then(data => {
  //        setLanguages(data.languages)
  //     });

  //     console.log(languages);
  //   }, []);
    
  
  // return (
  //   <header className="translator__header">
  //       {
  //         languages.length > 0 && (
  //           languages.map( lang => <h1>{lang.language}</h1>)
  //         )
  //       }
  //   </header>
  // );
};



// import React, { memo } from 'react';
// import PropTypes from 'prop-types';
// import { LoadingBar } from 'strapi-helper-plugin';

// const Menu = ({ error, isFirst, isLoading, title, content, link }) => {
//   if (isLoading) {
//     return (
//       <>
//         <LoadingBar style={{ marginBottom: 13 }} />
//         <LoadingBar style={{ width: '40%', marginBottom: 31 }} />
//       </>
//     );
//   }

//   if (error) {
//     return null;
//   }

//   return (
//     <a
//       rel="noopener noreferrer"
//       target="_blank"
//       href={`https://strapi.io/blog/${link}`}
//       style={{ color: '#333740' }}
//     >
//       <h2>{title}</h2>
//       <p style={{ marginTop: 17, marginBottom: isFirst ? 32 : 10 }}>{content}</p>
//     </a>
//   );
// };

// BlogPost.defaultProps = {
//   content: null,
//   isFirst: false,
//   link: null,
//   title: null,
// };

// BlogPost.propTypes = {
//   content: PropTypes.string,
//   error: PropTypes.bool.isRequired,
//   isFirst: PropTypes.bool,
//   isLoading: PropTypes.bool.isRequired,
//   link: PropTypes.string,
//   title: PropTypes.string,
// };

export default Menu;
#ifndef TSHARK_SERVER_TSHARK_API_HPP
#define TSHARK_SERVER_TSHARK_API_HPP
#include "controller/packet_controller.hpp"
#include "controller/session_controller.hpp"
#include "controller/stats_controller.hpp"
#include "controller/adaptor_controller.hpp"
#include "controller/process_controller.hpp"
#include <vector>
#include <memory>

class TSharkAPI {
public:

    void init(httplib::Server &server, TSharkManager &tsharkManager) {

        controllerList.push_back(std::make_shared<PacketController>(server, tsharkManager));
        controllerList.push_back(std::make_shared<SessionController>(server, tsharkManager));
        controllerList.push_back(std::make_shared<StatsController>(server, tsharkManager));
        controllerList.push_back(std::make_shared<AdaptorController>(server, tsharkManager));
        controllerList.push_back(std::make_shared<ProcessController>(server, tsharkManager));

        for (auto controller : controllerList) {
            controller->registerRoute();
        }
    }

private:
    std::vector<std::shared_ptr<BaseController>> controllerList;
};

#endif //TSHARK_SERVER_TSHARK_API_HPP
